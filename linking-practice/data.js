"use strict";
/* 句库：每句 [英文（| 分意群）, 中文意思, 对方自然的回应] */
const SCENES = [
  { key:"cafe", name:"咖啡店", en:"At a café", mark:"C", color:"var(--brown)", items:[
    ["Can I get | a medium iced latte | with oat milk?", "我要一杯中杯冰拿铁，加燕麦奶。", "Sure. Anything else for you?"],
    ["Could you make it | half sweet?", "能做半糖吗？", "No problem, I'll let the barista know."],
    ["Is that for here | or to go?", "堂食还是外带？", "To go, please."],
    ["Do you guys | have any decaf?", "你们有低因咖啡吗？", "We do. It's the same price as regular."],
    ["I think | this is someone else's order.", "我觉得这是别人点的。", "Oh, sorry about that! Let me fix it."],
    ["Can you leave | a little room | for milk?", "能留点空间加奶吗？", "You got it."],
    ["What do you | recommend?", "你推荐什么？", "Our cold brew is really popular right now."],
    ["Mind if I | sit here?", "介意我坐这儿吗？", "Not at all, go ahead."],
    ["What's the | Wi-Fi password?", "Wi-Fi 密码是多少？", "It's on the bottom of your receipt."],
    ["Could I get | a refill?", "能续杯吗？", "Sure, I'll be right back with that."]
  ]},
  { key:"dining", name:"餐厅", en:"At a restaurant", mark:"D", color:"var(--red)", items:[
    ["Can we get | a table for two?", "能给我们一张两人桌吗？", "Sure, right this way."],
    ["We're still | looking at the menu.", "我们还在看菜单。", "Take your time. I'll come back in a few."],
    ["I'll have | the chicken sandwich, | please.", "我要鸡肉三明治。", "Would you like fries or a salad with that?"],
    ["Could we get | some more water?", "能再给我们一些水吗？", "Of course, I'll bring a pitcher."],
    ["Can I get that | without onions?", "那个能不放洋葱吗？", "Absolutely, no onions."],
    ["Could we get | the check, | please?", "麻烦结账。", "Sure. Is this all on one card?"],
    ["Can we | split the bill?", "我们能分开付吗？", "No problem. How would you like to split it?"],
    ["Can I get a box | for this?", "能给我个打包盒吗？", "Sure, I'll grab one for you."],
    ["Everything was | really good.", "一切都很好吃。", "Glad you enjoyed it!"],
    ["Is the tip | included?", "小费已经包含了吗？", "No, it's not included."]
  ]},
  { key:"shop", name:"购物", en:"Shopping", mark:"S", color:"var(--purple)", items:[
    ["Do you have this | in a medium?", "这个有中号吗？", "Let me check in the back for you."],
    ["I'm just | looking, | thanks.", "我只是随便看看，谢谢。", "No problem. Let me know if you need anything."],
    ["Where's the | fitting room?", "试衣间在哪？", "It's right over there, past the shoes."],
    ["Is this | on sale?", "这个打折吗？", "Yeah, it's thirty percent off."],
    ["Can I | pay with card?", "能刷卡吗？", "Sure, just tap it right here."],
    ["I'd like to | return this.", "我想退掉这个。", "Do you have your receipt?"],
    ["Could I get | a bag, | please?", "能给我个袋子吗？", "Sure, that'll be ten cents."],
    ["It's a little | out of my budget.", "有点超出我的预算了。", "We have a similar one that's a bit cheaper."],
    ["Does this | come in black?", "这个有黑色的吗？", "It does, but only in smaller sizes."],
    ["I'll | think about it.", "我再考虑一下。", "Sure, take your time."]
  ]},
  { key:"work", name:"工作", en:"At work", mark:"W", color:"var(--blue)", items:[
    ["Do you have | a minute?", "你现在有空吗？", "Sure, what's up?"],
    ["Let me | get back to you | on that.", "这件事我回头答复你。", "Sounds good. No rush."],
    ["Can we | push the meeting | to Thursday?", "能把会推到周四吗？", "Thursday works for me."],
    ["I'm running | a little late.", "我会晚一点到。", "No worries, we'll wait for you."],
    ["Could you | send me | the file?", "能把文件发我吗？", "Sure, I'll email it to you right now."],
    ["Let's | touch base | next week.", "我们下周再碰一下。", "Sounds good. I'll set something up."],
    ["I'm on it.", "交给我，我马上处理。", "Great, thanks for jumping on that."],
    ["What's the | deadline | for this?", "这个什么时候截止？", "End of the day Friday."],
    ["Can you | walk me through it?", "你能带我过一遍吗？", "Sure, let me share my screen."],
    ["That makes sense.", "有道理，明白了。", "Great. Let me know if you have any questions."]
  ]},
  { key:"talk", name:"闲聊", en:"Small talk", mark:"H", color:"var(--green)", items:[
    ["How's it going?", "最近怎么样？", "Pretty good, thanks. How about you?"],
    ["What have you | been up to?", "最近在忙什么？", "Not much, just working a lot."],
    ["Long time | no see!", "好久不见！", "I know! It's been forever."],
    ["How was | your weekend?", "周末过得怎么样？", "It was nice and relaxing."],
    ["Any plans | for tonight?", "今晚有安排吗？", "Not really, probably just staying in."],
    ["It's been | a long day.", "今天真够累的。", "Tell me about it."],
    ["Where are you | from originally?", "你老家是哪里的？", "I'm from Chicago, but I live here now."],
    ["What do you do | for work?", "你做什么工作？", "I'm in marketing."],
    ["Nice to | finally meet you.", "终于见到你了，很高兴。", "You too! I've heard a lot about you."],
    ["I gotta | get going.", "我得走了。", "Okay, see you later!"]
  ]},
  { key:"plans", name:"约时间", en:"Making plans", mark:"P", color:"var(--orange)", items:[
    ["Are you free | this weekend?", "你这周末有空吗？", "I think so. What did you have in mind?"],
    ["Want to | grab lunch | sometime?", "改天一起吃个午饭？", "Sure, I'd love to."],
    ["What time | works for you?", "你什么时间方便？", "Anytime after three works for me."],
    ["Let's | meet up | at six.", "我们六点碰面吧。", "Perfect, see you then."],
    ["I might be | a few minutes late.", "我可能会晚几分钟。", "No problem, just text me when you're close."],
    ["Something | came up.", "临时有事了。", "Oh no, is everything okay?"],
    ["Can we | reschedule?", "我们能改个时间吗？", "Of course. How about next Tuesday?"],
    ["I'll | text you | the address.", "我把地址发短信给你。", "Great, thanks."],
    ["Count me in!", "算我一个！", "Awesome, it's gonna be fun."],
    ["I'll | let you know.", "我到时候告诉你。", "Okay, just let me know by Friday."]
  ]},
  { key:"travel", name:"出行住宿", en:"Travel & hotel", mark:"T", color:"var(--lime)", items:[
    ["I'd like to | check in, | please.", "我要办理入住。", "Sure. Can I see your ID?"],
    ["What time | is checkout?", "几点退房？", "Checkout is at eleven."],
    ["Is breakfast | included?", "含早餐吗？", "Yes, it's served from seven to ten."],
    ["Could I get | a late checkout?", "能延迟退房吗？", "I can give you until one o'clock."],
    ["How do I | get to the airport | from here?", "从这里怎么去机场？", "The easiest way is to take the train."],
    ["Is this seat | taken?", "这个座位有人吗？", "No, go ahead."],
    ["I'd like an | aisle seat | if possible.", "可以的话我想要靠过道的座位。", "Let me see what I can do."],
    ["My luggage | didn't show up.", "我的行李没出来。", "I'm sorry. Let's fill out a report."],
    ["Could you | call me a cab?", "能帮我叫辆出租车吗？", "Sure, it'll be here in about ten minutes."],
    ["Is it | within walking distance?", "走路能到吗？", "Yeah, it's about a ten-minute walk."]
  ]},
  { key:"health", name:"身体不适", en:"Feeling sick", mark:"+", color:"var(--yellow)", dark:true, items:[
    ["I'm not | feeling well.", "我不太舒服。", "Oh no. Do you want to go home early?"],
    ["I think I'm | coming down | with something.", "我觉得我快要生病了。", "Get some rest and drink lots of water."],
    ["I have | a sore throat.", "我嗓子疼。", "Try some warm tea with honey."],
    ["I'd like to | make an appointment.", "我想预约看诊。", "Sure. What day works best for you?"],
    ["How often | should I take this?", "这个药多久吃一次？", "Twice a day, with food."],
    ["Is there a pharmacy | around here?", "附近有药店吗？", "There's one on the corner."],
    ["I've had | a headache | all day.", "我头疼了一整天。", "Have you taken anything for it?"],
    ["I need to | call in sick | today.", "我今天得请病假。", "Feel better soon!"],
    ["I'm feeling | a lot better.", "我感觉好多了。", "Glad to hear that!"],
    ["Take it easy.", "别太累了，好好休息。", "Thanks, I will."]
  ]}
];

/* 口语话题：场景描述（中文）+ 可以用上的说法 */
const TOPICS = [
  { scene:"cafe", title:"点一杯咖啡", them:"Barista", brief:"你在美国的咖啡店。点一杯大杯热拿铁，要燕麦奶、半糖，再问问有没有不含坚果的点心。", hints:["Can I get…", "with oat milk", "half sweet", "Do you have anything…"] },
  { scene:"dining", title:"牛排没熟", them:"Server", brief:"你点的牛排太生了。礼貌地叫服务员，请他们拿回去再煎一下。", hints:["Excuse me", "a little undercooked", "Would you mind…"] },
  { scene:"talk", title:"派对上自我介绍", them:"New friend", brief:"在朋友的聚会上认识了新朋友。介绍一下你自己：住在哪里、做什么工作、平时喜欢做什么。", hints:["I'm originally from…", "I've been living in…", "In my free time…"] },
  { scene:"work", title:"请一天假", them:"Manager", brief:"跟主管说你明天要请一天假处理私事，并说明手头的工作已经安排好了。", hints:["I need to take tomorrow off", "I've already…", "If anything comes up…"] },
  { scene:"work", title:"会议改时间", them:"Coworker", brief:"你需要把明天上午的会挪到下午。跟同事解释原因，并确认新的时间。", hints:["Something came up", "Would it be okay if…", "Does 3 p.m. work?"] },
  { scene:"plans", title:"约朋友周末", them:"Friend", brief:"约朋友周六一起吃饭看电影，商量时间和地点。", hints:["Are you free…", "Want to…", "How about…"] },
  { scene:"travel", title:"酒店空调坏了", them:"Front desk", brief:"酒店房间的空调坏了。打给前台说明情况，请他们派人来修，或者给你换个房间。", hints:["I'm calling about…", "isn't working", "Could you send someone…"] },
  { scene:"travel", title:"问路", them:"Stranger", brief:"你在纽约街头迷路了。问路人最近的地铁站怎么走，走过去要多久。", hints:["Excuse me, do you know…", "How long does it take…"] },
  { scene:"shop", title:"换鞋子", them:"Clerk", brief:"你买的鞋小了。想换大一码，没有的话就退款。", hints:["I'd like to exchange…", "a size up", "If not…"] },
  { scene:"health", title:"看医生", them:"Doctor", brief:"向医生描述你的症状：嗓子疼、发烧两天了，还有点咳嗽。", hints:["I've had… for two days", "a sore throat", "a slight cough"] },
  { scene:"talk", title:"聊聊周末", them:"Coworker", brief:"同事问你周末干嘛了。分享一下你周末做了什么、感觉怎么样。", hints:["It was pretty…", "We ended up…", "It was so much fun"] },
  { scene:"talk", title:"说说你住的城市", them:"Friend", brief:"朋友问你：住在你现在这个城市，最喜欢的是什么，最不习惯的是什么？", hints:["What I love most is…", "One thing I'm still getting used to is…"] },
  { scene:"work", title:"项目要延期", them:"Client", brief:"告诉合作方项目要晚一周交付。先道歉，再给出新的时间安排。", hints:["I wanted to give you a heads-up", "pushed back", "We're aiming to…"] },
  { scene:"plans", title:"婉拒邀请", them:"Friend", brief:"朋友约你周五去喝一杯，你去不了。委婉地拒绝，并提议改天。", hints:["I'd love to, but…", "Can I take a rain check?"] },
  { scene:"work", title:"祝贺同事升职", them:"Coworker", brief:"同事升职了。真诚地祝贺他，再约他一起庆祝一下。", hints:["Congrats on…", "You totally deserve it", "We should celebrate"] },
  { scene:"shop", title:"找房东修水龙头", them:"Landlord", brief:"厨房水龙头一直漏水。打电话给房东，请他找人来修，并约个时间。", hints:["I wanted to let you know…", "leaking", "When would be a good time…"] }
];

/* 连读页的推荐句（连读点多） */
const LINK_PRESETS = [
  "Pick it up and put it on.",
  "Not at all.",
  "Can I have a cup of tea?",
  "Did you get it?",
  "What are you going to do about it?",
  "Take a look at it.",
  "Turn off the light and go out.",
  "Would you like a piece of cake?",
  "Tell him I'm at home.",
  "Thank you for all of your help.",
  "An apple a day keeps the doctor away.",
  "Nice to meet you."
];

const ALL_ITEMS = [];
SCENES.forEach(s => s.items.forEach((it, i) => ALL_ITEMS.push({
  id: `${s.key}-${i}`, scene: s.key, en: it[0].replace(/\s*\|\s*/g, " ").trim(), chunks: it[0].split("|").map(x => x.trim()), zh: it[1], reply: it[2]
})));
const SCENE_BY_KEY = Object.fromEntries(SCENES.map(s => [s.key, s]));
