package com.sylvenndt.dailyenglish;

import org.tukaani.xz.SeekableInputStream;
import org.tukaani.xz.SeekableXZInputStream;
import org.tukaani.xz.XZInputStream;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 解压 .xz 文件。CI 压缩时分成了很多块（--block-size），这里几个线程同时解不同的块，第一次打开时等得短一些；
 * 多线程出任何问题就退回一个线程从头解。纯 Java，不依赖安卓（电脑上也能测）。
 */
final class Unxz {
    interface Progress { void done(long bytes); }

    /** src 里从 off 开始、长 len 的一段是 .xz 数据，解压到 out */
    static void decompress(FileChannel src, long off, long len, File out, int threads, Progress p) throws IOException {
        try {
            parallel(src, off, len, out, threads, p);
        } catch (Throwable e) {
            sequential(new ChannelIn(src, off, len), out, p);
        }
    }

    private static void parallel(FileChannel src, long off, long len, File out, int threads, Progress p) throws Exception {
        SeekableXZInputStream idx = new SeekableXZInputStream(new ChannelIn(src, off, len));
        final int blocks = idx.getBlockCount();
        final long total = idx.length();
        if (blocks < 2 || threads < 2) throw new IOException("只有一块，不用多线程");
        final long[] pos = new long[blocks], size = new long[blocks];
        for (int i = 0; i < blocks; i++) { pos[i] = idx.getBlockPos(i); size[i] = idx.getBlockSize(i); }
        idx.close();
        final AtomicLong done = new AtomicLong();
        try (RandomAccessFile raf = new RandomAccessFile(out, "rw")) {
            raf.setLength(total);
            final FileChannel dst = raf.getChannel();
            ExecutorService pool = Executors.newFixedThreadPool(Math.min(threads, blocks));
            try {
                List<Future<?>> fs = new ArrayList<>();
                for (int i = 0; i < blocks; i++) {
                    final int b = i;
                    fs.add(pool.submit(() -> {
                        try (SeekableXZInputStream in = new SeekableXZInputStream(new ChannelIn(src, off, len))) {
                            in.seekToBlock(b);
                            byte[] buf = new byte[1 << 17];
                            long left = size[b], at = pos[b];
                            while (left > 0) {
                                int n = in.read(buf, 0, (int) Math.min(buf.length, left));
                                if (n <= 0) throw new IOException("块 " + b + " 提前结束");
                                ByteBuffer bb = ByteBuffer.wrap(buf, 0, n);
                                while (bb.hasRemaining()) at += dst.write(bb, at);
                                left -= n;
                                if (p != null) p.done(done.addAndGet(n));
                            }
                        }
                        return null;
                    }));
                }
                for (Future<?> f : fs) f.get();
            } finally {
                // 不能打断还在跑的线程：FileChannel 被打断会把共用的源文件也关掉，后面单线程重来就读不了了
                pool.shutdown();
                pool.awaitTermination(10, TimeUnit.MINUTES);
            }
        }
    }

    private static void sequential(InputStream raw, File out, Progress p) throws IOException {
        long done = 0;
        try (InputStream in = new XZInputStream(new BufferedInputStream(raw, 1 << 16));
             RandomAccessFile raf = new RandomAccessFile(out, "rw")) {
            raf.setLength(0);
            byte[] buf = new byte[1 << 17];
            int n;
            while ((n = in.read(buf)) > 0) { raf.write(buf, 0, n); done += n; if (p != null) p.done(done); }
        }
    }

    /** 文件里的一段，可以随意跳着读（每个线程各用一个，互不影响） */
    static final class ChannelIn extends SeekableInputStream {
        private final FileChannel ch;
        private final long off, len;
        private long pos = 0;

        ChannelIn(FileChannel ch, long off, long len) { this.ch = ch; this.off = off; this.len = len; }

        @Override public long length() { return len; }
        @Override public long position() { return pos; }
        @Override public void seek(long p) throws IOException { if (p < 0) throw new IOException("negative seek"); pos = p; }

        @Override
        public int read() throws IOException {
            byte[] b = new byte[1];
            return read(b, 0, 1) == 1 ? (b[0] & 0xff) : -1;
        }

        @Override
        public int read(byte[] b, int o, int n) throws IOException {
            if (n == 0) return 0;
            if (pos >= len) return -1;
            int want = (int) Math.min(n, len - pos);
            int r = ch.read(ByteBuffer.wrap(b, o, want), off + pos);
            if (r <= 0) return -1;
            pos += r;
            return r;
        }
    }
}
