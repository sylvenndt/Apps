"use strict";
/* 补充数据（2026-11）：
   EX_ZH：高频词汇例句、连读练习句子的中文；
   EX_REPLY：词汇 / 句型 / 句式例句「对方可能这样回」[英文, 中文]；
   另外把缺中文的对方回应补进 REPLY_ZH。 */
const EX_ZH = {
"I can't afford a new car right now.": "我现在买不起新车。",
"She applied for a job at a tech company.": "她申请了一家科技公司的工作。",
"My parents used to argue about money.": "我爸妈以前常为钱吵架。",
"I'll arrange a meeting for next week.": "我来安排下周开个会。",
"Are you going to attend the wedding?": "你会去参加婚礼吗？",
"I try to avoid driving during rush hour.": "我尽量避开高峰期开车。",
"Can I borrow your charger for a sec?": "能借你的充电器用一下吗？",
"He's always complaining about his boss.": "他老是抱怨他的老板。",
"Have you ever considered moving abroad?": "你考虑过搬到国外去吗？",
"They'll deliver the couch on Monday.": "他们周一会把沙发送过来。",
"My teacher encouraged me to keep writing.": "我老师鼓励我继续写作。",
"I didn't expect it to be so crowded.": "我没想到会这么挤。",
"My English has really improved this year.": "我的英语今年真的进步了。",
"Does the price include tax?": "这个价格含税吗？",
"I managed to finish everything on time.": "我设法按时把所有事做完了。",
"She mentioned that she's moving.": "她提到她要搬家了。",
"He offered to drive me home.": "他主动提出开车送我回家。",
"I prefer tea to coffee.": "比起咖啡，我更喜欢茶。",
"Washing your hands helps prevent colds.": "洗手有助于预防感冒。",
"I didn't realize it was so late.": "我没意识到已经这么晚了。",
"Can you recommend a good place to eat?": "你能推荐个好吃的地方吗？",
"I'm trying to reduce my screen time.": "我在努力减少看屏幕的时间。",
"She refused to answer the question.": "她拒绝回答那个问题。",
"Remind me to call my mom later.": "提醒我待会儿给我妈打电话。",
"I need to replace my phone screen.": "我得换个手机屏幕了。",
"The job requires a lot of travel.": "这份工作要经常出差。",
"I suggest we leave a little early.": "我建议我们早点出发。",
"I suppose you're right.": "我想你说得对吧。",
"I barely survived that meeting.": "那个会我差点没熬过去。",
"I wonder what she's doing now.": "不知道她现在在干嘛。",
"We finally achieved our sales goal.": "我们终于完成了销售目标。",
"I have to admit, I was wrong.": "我得承认，是我错了。",
"I really appreciate your help.": "真的很感谢你的帮助。",
"Let's celebrate your promotion tonight!": "今晚我们庆祝一下你升职吧！",
"Don't compare yourself to others.": "别拿自己和别人比。",
"It depends on the weather.": "那要看天气。",
"She earns more than her husband.": "她挣得比她老公多。",
"We spent the day exploring the city.": "我们花了一整天逛这座城市。",
"I'll never forgive him for that.": "那件事我永远不会原谅他。",
"They just hired a new manager.": "他们刚招了个新经理。",
"Could you lend me twenty bucks?": "能借我二十块钱吗？",
"I finally persuaded him to come.": "我终于说动他来了。",
"You can always rely on me.": "你随时都可以靠我。",
"I really respect her honesty.": "我真的很欣赏她的诚实。",
"Do you want to share a pizza?": "你想一起分一个披萨吗？",
"We need to solve this problem fast.": "我们得尽快解决这个问题。",
"Don't waste your time on that.": "别把时间浪费在那上面。",
"You deserve a break.": "你该休息一下了。",
"I doubt he'll show up on time.": "我怀疑他能准时到。",
"Can you handle this on your own?": "这个你自己能搞定吗？",
"I can't figure out how this works.": "我搞不懂这个怎么用。",
"She came up with a great idea.": "她想出了一个很棒的点子。",
"We ended up staying until midnight.": "我们最后一直待到半夜。",
"We ran out of milk again.": "我们的牛奶又喝完了。",
"Do you get along with your roommate?": "你和室友处得来吗？",
"I'm really looking forward to the trip.": "我真的很期待这次旅行。",
"Stop putting off your homework.": "别再拖着不写作业了。",
"Don't give up so easily.": "别这么轻易就放弃。",
"I just found out I got the job!": "我刚知道我拿到那份工作了！",
"I'll pick you up at seven.": "我七点来接你。",
"He didn't show up to the party.": "他没来参加聚会。",
"She turned down the job offer.": "她拒绝了那份工作邀请。",
"Don't worry, it'll all work out.": "别担心，一切都会好起来的。",
"You should check out this new café.": "你应该去看看这家新咖啡店。",
"Wanna hang out this weekend?": "这周末想一起出去玩吗？",
"Let's grab coffee and catch up.": "我们去喝杯咖啡叙叙旧吧。",
"I'll look into it and get back to you.": "我研究一下再回复你。",
"Don't worry, I'll take care of it.": "别担心，我来处理。",
"I have to deal with a lot of emails.": "我得处理一大堆邮件。",
"It took me a week to get over the flu.": "我花了一个星期才从流感里缓过来。",
"Calm down, it's not a big deal.": "冷静点，没什么大不了的。",
"Can you help me set up my new phone?": "你能帮我设置一下新手机吗？",
"I ran into my old teacher at the mall.": "我在商场碰到了我以前的老师。",
"Don't bring up politics at dinner.": "吃饭的时候别提政治。",
"She's going through a hard time.": "她正在经历一段艰难时期。",
"I'm trying to cut down on sugar.": "我在努力少吃糖。",
"They had a fight but made up the next day.": "他们吵了一架，但第二天就和好了。",
"Please fill out this form.": "请填一下这张表。",
"I signed up for a yoga class.": "我报了一个瑜伽班。",
"Hold on, let me grab my keys.": "等一下，我拿个钥匙。",
"Can I give you some advice?": "我能给你点建议吗？",
"There's a good chance it'll rain.": "很可能会下雨。",
"You don't really have a choice.": "你其实没得选。",
"It was a tough decision.": "那是个艰难的决定。",
"It was an amazing experience.": "那是一段很棒的经历。",
"What's your goal for this year?": "你今年的目标是什么？",
"Biting your nails is a bad habit.": "咬指甲是个坏习惯。",
"In my opinion, it's too expensive.": "在我看来，这太贵了。",
"This is a great opportunity for you.": "这对你来说是个好机会。",
"It's a tricky situation.": "这情况挺棘手的。",
"One advantage of living here is the weather.": "住在这儿的一个好处是天气好。",
"She has a really positive attitude.": "她的态度特别积极。",
"The deadline is next Friday.": "截止日期是下周五。",
"Is there an issue with the order?": "订单有什么问题吗？",
"I'm not in the mood to go out.": "我没心情出去。",
"We have a few options.": "我们有几个选择。",
"What's the purpose of this meeting?": "这次会议的目的是什么？",
"My schedule is packed this week.": "我这周的日程排得满满的。",
"Work has been a big source of stress.": "工作一直是我很大的压力来源。",
"Thanks for all your effort.": "谢谢你付出的所有努力。",
"Are you available tomorrow afternoon?": "你明天下午有空吗？",
"I wasn't aware of the problem.": "我之前不知道有这个问题。",
"She seems really confident.": "她看起来特别自信。",
"Is Tuesday convenient for you?": "周二你方便吗？",
"I was a little disappointed with the ending.": "我对结局有点失望。",
"I was so embarrassed when I tripped.": "我绊了一跤，尴尬死了。",
"This song sounds familiar.": "这首歌听着好耳熟。",
"I'm really impressed with your work.": "你的工作让我印象深刻。",
"It's pretty obvious he likes you.": "很明显他喜欢你。",
"Be patient, it'll get easier.": "耐心点，会越来越容易的。",
"The price seems reasonable.": "这个价格看起来挺合理的。",
"I feel so relaxed after a massage.": "按摩完我感觉好放松。",
"Who's responsible for this mess?": "这一团糟是谁弄的？",
"She's still upset about what you said.": "她还在为你说的话难过。",
"The view was totally worth it.": "那景色绝对值得。",
"Actually, I've changed my mind.": "其实我改主意了。",
"I'll probably be a little late.": "我可能会晚到一会儿。",
"I love fruit, especially mangoes.": "我爱吃水果，尤其是芒果。",
"Have you seen any good movies recently?": "你最近看过什么好电影吗？",
"He eventually agreed to help.": "他最终同意帮忙了。",
"He never acknowledged his mistake.": "他从来没承认过自己的错误。",
"It took me a while to adapt to the culture.": "我花了好一阵才适应这里的文化。",
"We didn't anticipate so many people.": "我们没料到会来这么多人。",
"I assumed you'd already left.": "我还以为你已经走了。",
"Could you clarify what you mean?": "你能说清楚你的意思吗？",
"I can't commit to anything right now.": "我现在什么都不能保证。",
"Everyone contributed to the project.": "每个人都为这个项目出了力。",
"You've convinced me. Let's do it.": "你说服我了，就这么干吧。",
"How do you cope with all that stress?": "那么大的压力你是怎么扛过来的？",
"He's always criticizing my cooking.": "他总是挑剔我做的菜。",
"I want to emphasize how important this is.": "我想强调这件事有多重要。",
"Please ensure the door is locked.": "请确保门锁好了。",
"We need to establish some ground rules.": "我们得定几条基本规矩。",
"We'll evaluate the results next month.": "我们下个月再评估结果。",
"Don't hesitate to call me.": "别犹豫，随时给我打电话。",
"Are you implying that I'm lying?": "你是在暗示我撒谎吗？",
"How can you justify spending that much?": "花那么多钱你怎么说得过去？",
"It's hard to maintain a healthy diet.": "要保持健康饮食很难。",
"We negotiated a better price.": "我们谈到了一个更好的价格。",
"She overcame her fear of flying.": "她克服了对坐飞机的恐惧。",
"The game was postponed because of rain.": "比赛因为下雨推迟了。",
"You need to prioritize your health.": "你得把健康放在第一位。",
"He decided to pursue a career in music.": "他决定从事音乐事业。",
"I regret not studying harder.": "我后悔当初没好好学习。",
"We resolved the issue pretty quickly.": "我们很快就把问题解决了。",
"I'm struggling to keep up.": "我很难跟上。",
"I tend to overthink things.": "我总是容易想太多。",
"How should we approach this problem?": "我们该怎么处理这个问题？",
"Stop distracting me, I'm working!": "别打扰我，我在工作！",
"The doctor reassured me it was nothing serious.": "医生安慰我说没什么大问题。",
"It's easy to overlook small details.": "小细节很容易被忽略。",
"He comes across as a little shy.": "他给人感觉有点害羞。",
"I couldn't get my point across.": "我没能把我的意思讲清楚。",
"The movie didn't live up to the hype.": "这部电影没达到宣传的那么好。",
"I can't put up with the noise anymore.": "我再也受不了这噪音了。",
"Let's stick to the plan.": "我们就按计划来吧。",
"He backed out at the last minute.": "他在最后一刻打了退堂鼓。",
"I need to brush up on my Spanish.": "我得复习一下我的西班牙语。",
"It all comes down to money.": "说到底都是钱的问题。",
"Our plans fell through.": "我们的计划泡汤了。",
"I'll go along with whatever you decide.": "你怎么决定我都同意。",
"It's hard to keep up with all the news.": "要跟上所有新闻太难了。",
"I've always looked up to my older sister.": "我一直很敬佩我姐姐。",
"We need to make up for lost time.": "我们得把失去的时间补回来。",
"I can't believe you pulled it off!": "真不敢相信你做成了！",
"We can't rule out the possibility.": "我们不能排除这种可能。",
"She talked me into going skydiving.": "她说动我去跳伞了。",
"Let's wrap up the meeting.": "我们把会议收个尾吧。",
"It turned out to be a great day.": "结果那天过得特别好。",
"I'll get back to you by Friday.": "我周五前给你答复。",
"Sorry, I didn't mean to cut you off.": "抱歉，我不是有意打断你的。",
"Feel free to drop by anytime.": "随时欢迎来坐坐。",
"Let me run it by my boss first.": "我先问问我老板的意见。",
"That's a pretty big assumption.": "这个假设可不小。",
"Having a dog is a big commitment.": "养狗是个很大的责任。",
"You'll have to deal with the consequences.": "你得自己承担后果。",
"Try to see it from my perspective.": "试着从我的角度看看。",
"Family is my top priority.": "家人是我最重要的。",
"Learning a language is a real challenge.": "学一门语言真的很有挑战。",
"My main concern is the cost.": "我最担心的是费用。",
"She made a great first impression.": "她给人的第一印象非常好。",
"What's your strategy for the interview?": "你面试的策略是什么？",
"He has a tendency to exaggerate.": "他说话容易夸大。",
"It's the latest trend online.": "这是网上最新的潮流。",
"We're on a tight budget this month.": "我们这个月预算很紧。",
"Let's find a compromise.": "我们找个折中的办法吧。",
"Thanks for the feedback.": "谢谢你的反馈。",
"That's a really interesting insight.": "这个见解真有意思。",
"What are the benefits of the job?": "这份工作有什么福利？",
"I don't want to be a burden.": "我不想成为负担。",
"I'm under a lot of pressure at work.": "我工作压力很大。",
"The restaurant has a great reputation.": "这家餐厅口碑很好。",
"There's been a lot of debate about it.": "这件事引起了很多争论。",
"My car isn't very reliable.": "我的车不太靠得住。",
"My hours are pretty flexible.": "我的工作时间挺灵活的。",
"Change is inevitable.": "变化是不可避免的。",
"I'm feeling a little overwhelmed.": "我有点不知所措。",
"I get so frustrated when it doesn't work.": "它不好使的时候我特别恼火。",
"I'm so grateful for your support.": "非常感谢你的支持。",
"There was an awkward silence.": "一阵尴尬的沉默。",
"That's not really relevant right now.": "这个现在其实不太相关。",
"There's been a significant improvement.": "已经有了明显的进步。",
"The instructions are pretty straightforward.": "说明书挺简单的。",
"It's been a tough week.": "这周真难熬。",
"She seems really genuine.": "她看起来很真诚。",
"That video was hilarious.": "那个视频笑死我了。",
"I'm absolutely exhausted.": "我累得要死。",
"That's so thoughtful of you.": "你太体贴了。",
"Apparently, the store is closing.": "听说那家店要关门了。",
"Basically, we need more time.": "说白了，我们需要更多时间。",
"I'm definitely coming tonight.": "今晚我肯定来。",
"Honestly, I don't really care.": "说实话，我真的不在乎。",
"Obviously, I didn't mean to hurt you.": "显然，我不是故意伤害你的。",
"I literally just got home.": "我真的才刚到家。",
"Seriously? You're quitting?": "说真的？你要辞职？",
"I love the city, whereas my wife prefers the countryside.": "我喜欢城市，而我太太更喜欢乡下。",
"Hurry up, otherwise we'll miss the train.": "快点，不然我们要错过火车了。",
"Meanwhile, I'll start making dinner.": "与此同时，我先开始做晚饭。",
"It was hard. Nevertheless, we finished on time.": "很难，尽管如此，我们还是按时完成了。",
"His answer was pretty ambiguous.": "他的回答相当含糊。",
"Try to give a coherent answer.": "尽量回答得有条理一些。",
"She made a compelling argument.": "她的论点很有说服力。",
"We need a comprehensive plan.": "我们需要一个全面的计划。",
"You need to be more consistent.": "你得更有恒心一些。",
"This decision is crucial.": "这个决定非常关键。",
"She gave very explicit instructions.": "她给的指示非常明确。",
"Is that even feasible?": "那真的可行吗？",
"There are risks inherent in any investment.": "任何投资都有其固有的风险。",
"He's meticulous about details.": "他对细节一丝不苟。",
"That's a plausible explanation.": "这个解释说得通。",
"It had a profound effect on me.": "这件事对我影响很深。",
"He was reluctant to talk about it.": "他不太愿意谈这件事。",
"There's a subtle difference.": "两者有细微的差别。",
"I felt really vulnerable.": "我当时觉得自己特别脆弱。",
"It's a really versatile jacket.": "这件夹克百搭。",
"Could you elaborate on that?": "你能详细说说吗？",
"Don't undermine my authority.": "别削弱我的威信。",
"This should alleviate the pain.": "这个应该能减轻疼痛。",
"She's great at articulating her ideas.": "她很善于把想法说清楚。",
"I'm contemplating a career change.": "我在考虑转行。",
"It's hard to discern the truth.": "很难分辨真相。",
"The new system will facilitate communication.": "新系统会方便大家沟通。",
"We want to foster a sense of community.": "我们想培养一种集体归属感。",
"How can we mitigate the risks?": "我们怎么降低风险？",
"Every decision is scrutinized.": "每个决定都会被仔细审视。",
"I don't want to speculate.": "我不想乱猜。",
"Never underestimate her.": "永远别小看她。",
"I'm in a bit of a dilemma.": "我有点左右为难。",
"What are the implications of this?": "这会带来什么影响？",
"There's no incentive to work harder.": "没有动力更努力工作。",
"It's hard to capture the nuance.": "很难把握其中的细微差别。",
"The only drawback is the price.": "唯一的缺点是价格。",
"It's just a minor setback.": "这只是个小挫折。",
"There's always a trade-off.": "总要有所取舍。",
"It was risky; nonetheless, we went ahead.": "有风险，但我们还是去做了。",
"It worked, albeit slowly.": "成功了，虽然慢了点。",
"He's arguably the best player ever.": "他可以说是史上最好的球员。",
"Inevitably, things went wrong.": "不可避免地，事情还是出了问题。",
"Presumably, he'll call us later.": "他大概待会儿会给我们打电话。",
"Pick it up and put it on.": "把它捡起来穿上。",
"Not at all.": "一点也不。／不客气。",
"Can I have a cup of tea?": "能给我来杯茶吗？",
"Did you get it?": "你拿到了吗？／你听懂了吗？",
"What are you going to do about it?": "你打算怎么处理这件事？",
"Take a look at it.": "看一下它。",
"Turn off the light and go out.": "关灯出去。",
"Would you like a piece of cake?": "要来块蛋糕吗？",
"Tell him I'm at home.": "告诉他我在家。",
"Thank you for all of your help.": "谢谢你的所有帮助。",
"An apple a day keeps the doctor away.": "一天一苹果，医生远离我。",
"Nice to meet you.": "很高兴认识你。"
};
const EX_REPLY = {
"I can't afford a new car right now.": [
"Yeah, cars are so expensive these days.",
"是啊，现在车太贵了。"
],
"She applied for a job at a tech company.": [
"Nice! I hope she gets it.",
"不错！希望她能拿到。"
],
"My parents used to argue about money.": [
"Mine too. It's pretty common.",
"我爸妈也是，很常见。"
],
"I'll arrange a meeting for next week.": [
"Great, just send me the time.",
"好，把时间发我就行。"
],
"Are you going to attend the wedding?": [
"Yeah, I wouldn't miss it.",
"去啊，我可不会错过。"
],
"I try to avoid driving during rush hour.": [
"Smart. Traffic is a nightmare.",
"明智，堵车太可怕了。"
],
"Can I borrow your charger for a sec?": [
"Sure, here you go.",
"当然，给你。"
],
"He's always complaining about his boss.": [
"Maybe he should just quit.",
"也许他该辞职算了。"
],
"Have you ever considered moving abroad?": [
"Yeah, I think about it all the time.",
"想过，我经常想这事。"
],
"They'll deliver the couch on Monday.": [
"Perfect, I'll be home all day.",
"太好了，我那天一整天都在家。"
],
"My teacher encouraged me to keep writing.": [
"That's awesome. You should listen to her.",
"太好了，你该听她的。"
],
"I didn't expect it to be so crowded.": [
"Me neither. It's crazy in here.",
"我也没想到，这里人太多了。"
],
"My English has really improved this year.": [
"I can tell! You sound great.",
"听得出来！你说得很好。"
],
"Does the price include tax?": [
"No, tax is extra.",
"不含，税另算。"
],
"I managed to finish everything on time.": [
"Nice job! That's impressive.",
"干得好！真厉害。"
],
"She mentioned that she's moving.": [
"Really? Where's she moving to?",
"真的吗？她要搬去哪儿？"
],
"He offered to drive me home.": [
"That was nice of him.",
"他人真好。"
],
"I prefer tea to coffee.": [
"Me too. Coffee makes me jittery.",
"我也是，喝咖啡我会心慌。"
],
"Washing your hands helps prevent colds.": [
"Yeah, especially in winter.",
"是啊，冬天尤其要洗。"
],
"I didn't realize it was so late.": [
"Time flies when you're having fun.",
"开心的时候时间过得快嘛。"
],
"Can you recommend a good place to eat?": [
"Sure, there's a great taco place nearby.",
"可以，附近有家很棒的塔可店。"
],
"I'm trying to reduce my screen time.": [
"Same here. It's so hard.",
"我也是，太难了。"
],
"She refused to answer the question.": [
"I don't blame her. It was too personal.",
"不怪她，那问题太私人了。"
],
"Remind me to call my mom later.": [
"Sure, I'll remind you after dinner.",
"好，吃完饭我提醒你。"
],
"I need to replace my phone screen.": [
"There's a repair shop down the street.",
"这条街上就有家修手机的。"
],
"The job requires a lot of travel.": [
"That sounds exhausting.",
"听着就累。"
],
"I suggest we leave a little early.": [
"Good idea. Traffic might be bad.",
"好主意，可能会堵车。"
],
"I suppose you're right.": [
"Thanks. I usually am.",
"谢啦，我一般都对。"
],
"I barely survived that meeting.": [
"That bad, huh?",
"有那么糟啊？"
],
"I wonder what she's doing now.": [
"Why don't you text her?",
"你给她发个消息呗。"
],
"We finally achieved our sales goal.": [
"Congrats! Drinks are on me.",
"恭喜！我请大家喝一杯。"
],
"I have to admit, I was wrong.": [
"It's okay. We all make mistakes.",
"没事，谁都会犯错。"
],
"I really appreciate your help.": [
"No problem. Anytime.",
"不客气，随时找我。"
],
"Let's celebrate your promotion tonight!": [
"Sounds great. Where should we go?",
"好啊，去哪儿？"
],
"Don't compare yourself to others.": [
"I know, but it's hard not to.",
"我知道，可是很难做到。"
],
"It depends on the weather.": [
"Let's check the forecast.",
"那我们看看天气预报。"
],
"She earns more than her husband.": [
"Good for her!",
"她真厉害！"
],
"We spent the day exploring the city.": [
"Sounds fun. What was your favorite part?",
"听着不错，你最喜欢哪儿？"
],
"I'll never forgive him for that.": [
"I don't blame you.",
"不怪你。"
],
"They just hired a new manager.": [
"Oh yeah? What's he like?",
"是吗？他人怎么样？"
],
"Could you lend me twenty bucks?": [
"Sure, just pay me back Friday.",
"行，周五还我就好。"
],
"I finally persuaded him to come.": [
"Nice! How'd you do it?",
"厉害！你怎么做到的？"
],
"You can always rely on me.": [
"Thanks. That means a lot.",
"谢谢，这对我很重要。"
],
"I really respect her honesty.": [
"Yeah, she always tells it like it is.",
"是啊，她向来有话直说。"
],
"Do you want to share a pizza?": [
"Sure, but no pineapple.",
"好啊，但别放菠萝。"
],
"We need to solve this problem fast.": [
"Agreed. Let's get everyone together.",
"同意，把大家叫到一起吧。"
],
"Don't waste your time on that.": [
"You're right. It's not worth it.",
"你说得对，不值得。"
],
"You deserve a break.": [
"Thanks. I really need one.",
"谢谢，我真的需要歇歇。"
],
"I doubt he'll show up on time.": [
"Yeah, he's always late.",
"是啊，他总迟到。"
],
"Can you handle this on your own?": [
"Yeah, I think I've got it.",
"可以，我应该能搞定。"
],
"I can't figure out how this works.": [
"Here, let me show you.",
"来，我给你演示一下。"
],
"She came up with a great idea.": [
"She's always so creative.",
"她一直很有创意。"
],
"We ended up staying until midnight.": [
"Wow, you must've had fun.",
"哇，你们一定玩得很开心。"
],
"We ran out of milk again.": [
"I'll grab some on my way home.",
"我回家路上买点。"
],
"Do you get along with your roommate?": [
"Yeah, we get along great.",
"处得来，我们关系很好。"
],
"I'm really looking forward to the trip.": [
"Me too! It's gonna be amazing.",
"我也是！一定会很棒。"
],
"Stop putting off your homework.": [
"Okay, okay. I'll start now.",
"好啦好啦，我现在就写。"
],
"Don't give up so easily.": [
"You're right. I'll give it another shot.",
"你说得对，我再试一次。"
],
"I just found out I got the job!": [
"That's amazing! Congratulations!",
"太棒了！恭喜你！"
],
"I'll pick you up at seven.": [
"Great, I'll be ready.",
"好，我会准备好的。"
],
"He didn't show up to the party.": [
"Really? That's not like him.",
"真的吗？这不像他啊。"
],
"She turned down the job offer.": [
"Wow, why'd she do that?",
"哇，她为什么拒绝？"
],
"Don't worry, it'll all work out.": [
"Thanks. I hope you're right.",
"谢谢，希望你说得对。"
],
"You should check out this new café.": [
"Oh yeah? What's good there?",
"是吗？那儿什么好喝？"
],
"Wanna hang out this weekend?": [
"Sure! What do you wanna do?",
"好啊！你想干嘛？"
],
"Let's grab coffee and catch up.": [
"I'd love that. How about Saturday?",
"好啊，周六怎么样？"
],
"I'll look into it and get back to you.": [
"Great, thanks for checking.",
"好的，谢谢你帮忙查。"
],
"Don't worry, I'll take care of it.": [
"You're a lifesaver.",
"你真是救星。"
],
"I have to deal with a lot of emails.": [
"Ugh, I know the feeling.",
"唉，我懂那种感觉。"
],
"It took me a week to get over the flu.": [
"Glad you're feeling better now.",
"你现在好些了就好。"
],
"Calm down, it's not a big deal.": [
"Sorry, I just got a little stressed.",
"抱歉，我刚才有点紧张。"
],
"Can you help me set up my new phone?": [
"Sure, hand it over.",
"行，拿过来吧。"
],
"I ran into my old teacher at the mall.": [
"Small world! Did she remember you?",
"世界真小！她还记得你吗？"
],
"Don't bring up politics at dinner.": [
"Good call. It always turns into a fight.",
"说得对，一提准吵起来。"
],
"She's going through a hard time.": [
"I'm sorry to hear that. Is she okay?",
"听着真难过，她还好吗？"
],
"I'm trying to cut down on sugar.": [
"Good for you. That's not easy.",
"真不错，这可不容易。"
],
"They had a fight but made up the next day.": [
"That's good. They're cute together.",
"那就好，他俩挺配的。"
],
"Please fill out this form.": [
"Sure. Do you have a pen?",
"好的，有笔吗？"
],
"I signed up for a yoga class.": [
"Nice! How many times a week?",
"不错！一周几次？"
],
"Hold on, let me grab my keys.": [
"Take your time.",
"不着急。"
],
"Can I give you some advice?": [
"Sure, I'm all ears.",
"当然，你说吧。"
],
"There's a good chance it'll rain.": [
"I'll bring an umbrella then.",
"那我带把伞。"
],
"You don't really have a choice.": [
"Yeah, I guess you're right.",
"嗯，你说得对吧。"
],
"It was a tough decision.": [
"I think you made the right call.",
"我觉得你做得对。"
],
"It was an amazing experience.": [
"I'm so glad you got to do it.",
"真为你能去体验高兴。"
],
"What's your goal for this year?": [
"I wanna run a half marathon.",
"我想跑个半马。"
],
"Biting your nails is a bad habit.": [
"I know. I'm trying to stop.",
"我知道，我在努力改。"
],
"In my opinion, it's too expensive.": [
"Yeah, I agree. Let's look around.",
"我同意，我们再看看别家。"
],
"This is a great opportunity for you.": [
"I know. I'm really excited about it.",
"我知道，我特别兴奋。"
],
"It's a tricky situation.": [
"What are you gonna do?",
"那你打算怎么办？"
],
"One advantage of living here is the weather.": [
"True. The winters are so mild.",
"确实，冬天很暖和。"
],
"She has a really positive attitude.": [
"Yeah, she's always so upbeat.",
"是啊，她总是很乐观。"
],
"The deadline is next Friday.": [
"Okay, that gives us a week.",
"好，那我们还有一周时间。"
],
"Is there an issue with the order?": [
"Yeah, one item is missing.",
"有，少了一件东西。"
],
"I'm not in the mood to go out.": [
"Okay, let's just stay in tonight.",
"好吧，那今晚就待在家里。"
],
"We have a few options.": [
"Let's hear them.",
"说来听听。"
],
"What's the purpose of this meeting?": [
"We're planning the new project.",
"我们要规划新项目。"
],
"My schedule is packed this week.": [
"Let's meet next week, then.",
"那我们下周见吧。"
],
"Work has been a big source of stress.": [
"Have you thought about taking some time off?",
"你有没有想过休个假？"
],
"Thanks for all your effort.": [
"Happy to help.",
"很乐意帮忙。"
],
"Are you available tomorrow afternoon?": [
"Yeah, after two works for me.",
"有，两点以后我都行。"
],
"I wasn't aware of the problem.": [
"No worries. We just found out too.",
"没事，我们也是刚发现。"
],
"She seems really confident.": [
"Yeah, she really owns the room.",
"是啊，她一出场就镇得住。"
],
"Is Tuesday convenient for you?": [
"Tuesday works great.",
"周二很合适。"
],
"I was a little disappointed with the ending.": [
"Same. It felt kind of rushed.",
"我也是，感觉有点草草收场。"
],
"I was so embarrassed when I tripped.": [
"Don't worry, everyone does it.",
"别在意，谁都摔过。"
],
"This song sounds familiar.": [
"It was really popular a few years ago.",
"几年前这首歌很火。"
],
"I'm really impressed with your work.": [
"Thanks, I worked really hard on it.",
"谢谢，我下了很大功夫。"
],
"It's pretty obvious he likes you.": [
"You think so? I had no idea.",
"你这么觉得？我完全没发现。"
],
"Be patient, it'll get easier.": [
"Thanks. I'll keep at it.",
"谢谢，我会坚持的。"
],
"The price seems reasonable.": [
"Yeah, let's go for it.",
"嗯，那就买吧。"
],
"I feel so relaxed after a massage.": [
"I need to book one too.",
"我也得去约一个。"
],
"Who's responsible for this mess?": [
"Sorry, that was me. I'll clean it up.",
"抱歉，是我，我来收拾。"
],
"She's still upset about what you said.": [
"I know. I'll apologize to her.",
"我知道，我会去跟她道歉。"
],
"The view was totally worth it.": [
"I'll have to go see it myself.",
"我得亲自去看看。"
],
"Actually, I've changed my mind.": [
"No problem. What do you want instead?",
"没问题，那你想要什么？"
],
"I'll probably be a little late.": [
"No worries. Just text me when you're close.",
"没事，快到了给我发个消息。"
],
"I love fruit, especially mangoes.": [
"Me too. They're so sweet.",
"我也是，芒果好甜。"
],
"Have you seen any good movies recently?": [
"Yeah, I just saw a great one last night.",
"看了，昨晚刚看了一部很好的。"
],
"He eventually agreed to help.": [
"Good. We really need him.",
"太好了，我们真的需要他。"
],
"He never acknowledged his mistake.": [
"That's so typical of him.",
"他就是这样。"
],
"It took me a while to adapt to the culture.": [
"I bet. It's really different here.",
"我能想象，这儿差别挺大的。"
],
"We didn't anticipate so many people.": [
"It's a good problem to have.",
"这是个甜蜜的烦恼。"
],
"I assumed you'd already left.": [
"Nope, I was just in the back.",
"没有，我刚才在后面。"
],
"Could you clarify what you mean?": [
"Sure. Let me explain.",
"好，我解释一下。"
],
"I can't commit to anything right now.": [
"That's okay. No pressure.",
"没关系，别有压力。"
],
"Everyone contributed to the project.": [
"It was a real team effort.",
"这真是大家一起努力的结果。"
],
"You've convinced me. Let's do it.": [
"Awesome! You won't regret it.",
"太好了！你不会后悔的。"
],
"How do you cope with all that stress?": [
"I go running every morning.",
"我每天早上去跑步。"
],
"He's always criticizing my cooking.": [
"Then let him cook for once.",
"那就让他做一回饭。"
],
"I want to emphasize how important this is.": [
"Got it. We'll take it seriously.",
"明白，我们会认真对待。"
],
"Please ensure the door is locked.": [
"Don't worry, I'll double-check.",
"别担心，我再检查一遍。"
],
"We need to establish some ground rules.": [
"Good idea. Like what?",
"好主意，比如说？"
],
"We'll evaluate the results next month.": [
"Sounds good. Let's put it on the calendar.",
"好，我们记到日程上。"
],
"Don't hesitate to call me.": [
"Thanks, I really appreciate it.",
"谢谢，真的很感激。"
],
"Are you implying that I'm lying?": [
"No, that's not what I meant.",
"不是，我不是那个意思。"
],
"How can you justify spending that much?": [
"It's an investment. Trust me.",
"这是投资，相信我。"
],
"It's hard to maintain a healthy diet.": [
"Yeah, especially with all the snacks around.",
"是啊，尤其是身边全是零食。"
],
"We negotiated a better price.": [
"Nice! How much did you save?",
"不错！省了多少？"
],
"She overcame her fear of flying.": [
"Good for her. That takes guts.",
"真为她高兴，这需要勇气。"
],
"The game was postponed because of rain.": [
"Bummer. When's the new date?",
"真扫兴，改到哪天了？"
],
"You need to prioritize your health.": [
"You're right. I'll slow down.",
"你说得对，我会放慢节奏。"
],
"He decided to pursue a career in music.": [
"That's brave. I hope it works out.",
"真有勇气，希望他成功。"
],
"I regret not studying harder.": [
"It's never too late to start.",
"什么时候开始都不晚。"
],
"We resolved the issue pretty quickly.": [
"Great work, everyone.",
"大家干得好。"
],
"I'm struggling to keep up.": [
"Don't worry, I'll help you catch up.",
"别担心，我帮你赶上。"
],
"I tend to overthink things.": [
"Same. I'm working on it.",
"我也是，我在改。"
],
"How should we approach this problem?": [
"Let's start with the easy parts.",
"先从简单的部分下手吧。"
],
"Stop distracting me, I'm working!": [
"Sorry, I'll leave you alone.",
"抱歉，我不吵你了。"
],
"The doctor reassured me it was nothing serious.": [
"Thank goodness. I was worried.",
"谢天谢地，我还担心呢。"
],
"It's easy to overlook small details.": [
"That's why we double-check everything.",
"所以我们每样都要复查。"
],
"He comes across as a little shy.": [
"He's actually really funny once you know him.",
"熟了以后他其实很逗。"
],
"I couldn't get my point across.": [
"Try writing it down first.",
"先写下来试试。"
],
"The movie didn't live up to the hype.": [
"Yeah, I expected way more.",
"是啊，我期望高多了。"
],
"I can't put up with the noise anymore.": [
"Maybe talk to your neighbors?",
"要不跟邻居说说？"
],
"Let's stick to the plan.": [
"Agreed. No more changes.",
"同意，不再改了。"
],
"He backed out at the last minute.": [
"Typical. He always does that.",
"老样子，他总这样。"
],
"I need to brush up on my Spanish.": [
"Try watching some shows in Spanish.",
"试试看西班牙语的剧。"
],
"It all comes down to money.": [
"Isn't it always?",
"不一向如此吗？"
],
"Our plans fell through.": [
"Oh no. What happened?",
"啊，怎么了？"
],
"I'll go along with whatever you decide.": [
"Okay, let's go with pizza.",
"好，那就吃披萨吧。"
],
"It's hard to keep up with all the news.": [
"I just read the headlines.",
"我就只看看标题。"
],
"I've always looked up to my older sister.": [
"She sounds like a great role model.",
"听起来她是个好榜样。"
],
"We need to make up for lost time.": [
"Let's get started right away.",
"那我们马上开始吧。"
],
"I can't believe you pulled it off!": [
"Me neither, honestly.",
"说实话，我自己也不敢信。"
],
"We can't rule out the possibility.": [
"True. Let's keep an eye on it.",
"确实，我们留意着。"
],
"She talked me into going skydiving.": [
"No way! Were you scared?",
"不会吧！你怕吗？"
],
"Let's wrap up the meeting.": [
"Sounds good. Thanks, everyone.",
"好，谢谢大家。"
],
"It turned out to be a great day.": [
"I'm so glad it worked out.",
"真高兴结果这么好。"
],
"I'll get back to you by Friday.": [
"Perfect, thanks.",
"好的，谢谢。"
],
"Sorry, I didn't mean to cut you off.": [
"No worries. Go ahead.",
"没关系，你说吧。"
],
"Feel free to drop by anytime.": [
"Thanks, I'll stop by sometime.",
"谢谢，我改天过去。"
],
"Let me run it by my boss first.": [
"Sure, let me know what he says.",
"好，他怎么说告诉我。"
],
"That's a pretty big assumption.": [
"Maybe, but I think I'm right.",
"也许吧，但我觉得我没错。"
],
"Having a dog is a big commitment.": [
"I know. I'm ready for it.",
"我知道，我准备好了。"
],
"You'll have to deal with the consequences.": [
"Fine. I'll take responsibility.",
"行，我自己负责。"
],
"Try to see it from my perspective.": [
"Okay, I'll try.",
"好，我试试。"
],
"Family is my top priority.": [
"Same here. Family comes first.",
"我也是，家人第一。"
],
"Learning a language is a real challenge.": [
"But it's so worth it.",
"但非常值得。"
],
"My main concern is the cost.": [
"Let's see if there's a cheaper option.",
"看看有没有便宜点的选择。"
],
"She made a great first impression.": [
"Yeah, everyone loved her.",
"是啊，大家都喜欢她。"
],
"What's your strategy for the interview?": [
"Just be myself and stay calm.",
"做自己，保持冷静。"
],
"He has a tendency to exaggerate.": [
"Yeah, I take what he says with a grain of salt.",
"是啊，他的话我都打个折听。"
],
"It's the latest trend online.": [
"I've seen it everywhere.",
"我到处都能看到。"
],
"We're on a tight budget this month.": [
"Let's cook at home more, then.",
"那我们多在家做饭吧。"
],
"Let's find a compromise.": [
"Okay, what do you suggest?",
"好，你有什么建议？"
],
"Thanks for the feedback.": [
"Anytime. Hope it helps.",
"随时，希望有帮助。"
],
"That's a really interesting insight.": [
"Thanks, I've been thinking about it a lot.",
"谢谢，我想了很久。"
],
"What are the benefits of the job?": [
"Health insurance and a gym membership.",
"有医保，还有健身卡。"
],
"I don't want to be a burden.": [
"You're not a burden at all.",
"你一点都不是负担。"
],
"I'm under a lot of pressure at work.": [
"Hang in there. You've got this.",
"坚持住，你可以的。"
],
"The restaurant has a great reputation.": [
"Let's go there for your birthday.",
"你生日就去那儿吧。"
],
"There's been a lot of debate about it.": [
"Yeah, people have strong opinions.",
"是啊，大家看法都很强烈。"
],
"My car isn't very reliable.": [
"Maybe it's time for a new one.",
"也许该换辆新的了。"
],
"My hours are pretty flexible.": [
"Lucky you. Mine are so strict.",
"你真幸运，我的特别死板。"
],
"Change is inevitable.": [
"True. We just have to adapt.",
"没错，我们只能适应。"
],
"I'm feeling a little overwhelmed.": [
"Let's take it one step at a time.",
"我们一步一步来。"
],
"I get so frustrated when it doesn't work.": [
"Try turning it off and on again.",
"关了再开试试。"
],
"I'm so grateful for your support.": [
"Of course. That's what friends are for.",
"当然，朋友就该这样。"
],
"There was an awkward silence.": [
"Yeah, nobody knew what to say.",
"是啊，谁都不知道说什么。"
],
"That's not really relevant right now.": [
"Fair point. Let's move on.",
"说得对，我们继续吧。"
],
"There's been a significant improvement.": [
"That's great to hear.",
"太好了。"
],
"The instructions are pretty straightforward.": [
"Good. I'll set it up myself, then.",
"好，那我自己装。"
],
"It's been a tough week.": [
"Let's grab a drink and unwind.",
"我们去喝一杯放松一下。"
],
"She seems really genuine.": [
"Yeah, she's one of the good ones.",
"是啊，她是个好人。"
],
"That video was hilarious.": [
"Send it to me!",
"发给我！"
],
"I'm absolutely exhausted.": [
"Go take a nap.",
"去睡一觉吧。"
],
"That's so thoughtful of you.": [
"It's nothing. I'm happy to help.",
"小事，很乐意帮忙。"
],
"Apparently, the store is closing.": [
"Oh no, I love that place.",
"啊，我好喜欢那家店。"
],
"Basically, we need more time.": [
"How much more?",
"还需要多久？"
],
"I'm definitely coming tonight.": [
"Great! See you there.",
"太好了！到时见。"
],
"Honestly, I don't really care.": [
"Fair enough.",
"好吧，可以理解。"
],
"Obviously, I didn't mean to hurt you.": [
"I know. I'm not mad.",
"我知道，我没生气。"
],
"I literally just got home.": [
"Okay, take your time.",
"好，你慢慢来。"
],
"Seriously? You're quitting?": [
"Yep. I've had enough.",
"是啊，我受够了。"
],
"I love the city, whereas my wife prefers the countryside.": [
"Maybe the suburbs are a good compromise.",
"也许郊区是个折中的选择。"
],
"Hurry up, otherwise we'll miss the train.": [
"I'm coming, I'm coming!",
"来了来了！"
],
"Meanwhile, I'll start making dinner.": [
"Thanks, I'll set the table.",
"谢谢，我来摆桌子。"
],
"It was hard. Nevertheless, we finished on time.": [
"That's what I call teamwork.",
"这才叫团队合作。"
],
"His answer was pretty ambiguous.": [
"Yeah, I couldn't tell what he meant.",
"是啊，我听不出他什么意思。"
],
"Try to give a coherent answer.": [
"Okay, let me start over.",
"好，我重新说。"
],
"She made a compelling argument.": [
"She totally changed my mind.",
"她完全改变了我的看法。"
],
"We need a comprehensive plan.": [
"Let's start working on it today.",
"今天就开始做吧。"
],
"You need to be more consistent.": [
"You're right. I'll try harder.",
"你说得对，我会更努力。"
],
"This decision is crucial.": [
"Then let's take our time.",
"那我们慢慢来。"
],
"She gave very explicit instructions.": [
"Good. Then there's no confusion.",
"好，那就不会搞错了。"
],
"Is that even feasible?": [
"I think so, if we plan well.",
"我觉得行，只要计划好。"
],
"There are risks inherent in any investment.": [
"That's why I don't invest much.",
"所以我投得不多。"
],
"He's meticulous about details.": [
"That's why he's so good at his job.",
"所以他工作这么出色。"
],
"That's a plausible explanation.": [
"Yeah, that makes sense.",
"嗯，有道理。"
],
"It had a profound effect on me.": [
"I can tell. You've changed a lot.",
"看得出来，你变了很多。"
],
"He was reluctant to talk about it.": [
"Let's give him some space.",
"给他点空间吧。"
],
"There's a subtle difference.": [
"I can't really tell them apart.",
"我真分不出来。"
],
"I felt really vulnerable.": [
"That's totally normal.",
"这很正常。"
],
"It's a really versatile jacket.": [
"I might get one too.",
"我可能也买一件。"
],
"Could you elaborate on that?": [
"Sure. Let me give you an example.",
"好，我举个例子。"
],
"Don't undermine my authority.": [
"Sorry, that wasn't my intention.",
"抱歉，我不是那个意思。"
],
"This should alleviate the pain.": [
"Thanks, doctor.",
"谢谢医生。"
],
"She's great at articulating her ideas.": [
"Yeah, she's a natural speaker.",
"是啊，她天生会说话。"
],
"I'm contemplating a career change.": [
"What would you do instead?",
"那你想做什么？"
],
"It's hard to discern the truth.": [
"Let's wait for more information.",
"等更多消息出来再说吧。"
],
"The new system will facilitate communication.": [
"That'll save us a lot of time.",
"这能省很多时间。"
],
"We want to foster a sense of community.": [
"Maybe start with a team dinner.",
"可以先从团队聚餐开始。"
],
"How can we mitigate the risks?": [
"Let's start small and see how it goes.",
"先小规模试试看。"
],
"Every decision is scrutinized.": [
"That's a lot of pressure.",
"压力好大。"
],
"I don't want to speculate.": [
"Fair enough. Let's wait and see.",
"也对，我们等等看。"
],
"Never underestimate her.": [
"Trust me, I won't.",
"放心，我不会的。"
],
"I'm in a bit of a dilemma.": [
"What's going on?",
"怎么了？"
],
"What are the implications of this?": [
"It could change everything.",
"可能会改变一切。"
],
"There's no incentive to work harder.": [
"Maybe ask your boss for a raise.",
"要不找老板要求加薪。"
],
"It's hard to capture the nuance.": [
"Yeah, some things get lost in translation.",
"是啊，有些东西一翻译就没了。"
],
"The only drawback is the price.": [
"Yeah, but it's worth every penny.",
"是啊，不过物有所值。"
],
"It's just a minor setback.": [
"You'll bounce back in no time.",
"你很快就能缓过来。"
],
"There's always a trade-off.": [
"True. You can't have it all.",
"没错，鱼和熊掌不可兼得。"
],
"It was risky; nonetheless, we went ahead.": [
"And it paid off!",
"结果成功了！"
],
"It worked, albeit slowly.": [
"Slow is better than nothing.",
"慢总比没有强。"
],
"He's arguably the best player ever.": [
"No doubt about it.",
"毫无疑问。"
],
"Inevitably, things went wrong.": [
"Well, that's life.",
"嗯，生活就是这样。"
],
"Presumably, he'll call us later.": [
"I hope so. I'm getting worried.",
"希望如此，我有点担心了。"
],
"My phone died.": [
"Here, use my charger.",
"给，用我的充电器吧。"
],
"Prices went up again.": [
"I know. Everything costs more now.",
"是啊，现在什么都更贵了。"
],
"You look tired.": [
"Yeah, I didn't sleep much last night.",
"是啊，我昨晚没怎么睡。"
],
"This soup tastes amazing.": [
"Thanks! It's my grandma's recipe.",
"谢谢！这是我奶奶的配方。"
],
"I love this song.": [
"Me too! It's so catchy.",
"我也是！太上头了。"
],
"She's learning Japanese.": [
"Wow, that's a tough language.",
"哇，那门语言可不好学。"
],
"Can you send me the file?": [
"Sure, I'll email it to you now.",
"好，我现在就发你邮箱。"
],
"My dad bought me a bike.": [
"That's sweet. Do you ride it a lot?",
"真好，你经常骑吗？"
],
"The news made me so happy.": [
"I'm so happy for you!",
"真为你高兴！"
],
"Just leave the door open.": [
"Okay, no problem.",
"好，没问题。"
],
"What you said really helped.": [
"I'm really glad it helped.",
"能帮上忙我很高兴。"
],
"It's obvious that he likes you.": [
"Is it? I didn't notice.",
"是吗？我都没注意到。"
],
"I think it's a great idea.": [
"Thanks! Let's give it a try.",
"谢谢！那我们试试吧。"
],
"Do you know if she's coming?": [
"I think so. She said she'd try.",
"应该来，她说会尽量。"
],
"The problem is that we're out of time.": [
"Then let's focus on what matters most.",
"那我们先抓最重要的。"
],
"That's exactly what I meant.": [
"Great, I'm glad we're on the same page.",
"好，很高兴我们想法一致。"
],
"I had a feeling that something was wrong.": [
"Me too. I'm glad we checked.",
"我也是，幸好我们查了一下。"
],
"The fact that he lied really bothers me.": [
"I get it. Trust is everything.",
"我懂，信任最重要。"
],
"I have a friend who lives in LA.": [
"Oh, nice! Do you visit often?",
"不错！你常去看他吗？"
],
"She's the one that called earlier.": [
"Oh, okay. I'll call her back.",
"哦，好，我给她回电话。"
],
"Is this the book you were talking about?": [
"Yep, that's the one. Enjoy!",
"对，就是这本，好好看！"
],
"The car that I rented broke down.": [
"Oh no. Did you call the rental company?",
"糟了，你给租车公司打电话了吗？"
],
"That's the restaurant where we had our first date.": [
"Aw, we should go back sometime.",
"哇，我们改天该再去一次。"
],
"I still remember the day when we met.": [
"Me too. It feels like yesterday.",
"我也记得，就像昨天一样。"
],
"I met a guy whose brother plays in the NBA.": [
"No way! That's so cool.",
"不会吧！太酷了。"
],
"That's the neighbor whose dog never stops barking.": [
"Ugh, that would drive me crazy.",
"唉，换我会被逼疯的。"
],
"We went to Kyoto, which was beautiful.": [
"I'd love to go there someday.",
"我真想哪天也去看看。"
],
"My boss, who's usually calm, totally lost it.": [
"Wow, what happened?",
"哇，出什么事了？"
],
"Text me when you get home.": [
"I will. Don't worry.",
"会的，别担心。"
],
"I'll wait here until you're done.": [
"Thanks, it won't take long.",
"谢谢，不会太久的。"
],
"If you're free, let's grab lunch.": [
"Sounds good. I'm free after twelve.",
"好啊，我十二点以后有空。"
],
"We'll be fine as long as we leave now.": [
"Okay, let me grab my bag.",
"好，我拿下包。"
],
"I stayed home because I wasn't feeling well.": [
"Oh no. Are you feeling better now?",
"啊，你现在好点了吗？"
],
"Since you're here, can you help me with this?": [
"Sure, what do you need?",
"好啊，需要我做什么？"
],
"Although it was late, we kept talking.": [
"Those are the best conversations.",
"那种聊天最棒了。"
],
"I'm going even if it rains.": [
"Wow, you're really committed.",
"哇，你真够执着的。"
],
"I left early so I wouldn't miss the train.": [
"Good thinking.",
"想得周到。"
],
"Speak up so everyone can hear you.": [
"Sorry, I'll talk louder.",
"抱歉，我大声点。"
],
"I was so tired that I fell asleep on the couch.": [
"You must have been exhausted.",
"你一定累坏了。"
],
"It was such a nice day that we went to the beach.": [
"Sounds perfect. Did you swim?",
"听着太完美了，你下水了吗？"
],
"It took longer than I expected.": [
"Things usually do.",
"事情通常都是这样。"
],
"Come as soon as you can.": [
"I'm on my way.",
"我在路上了。"
],
"Put it back where you found it.": [
"Got it. Sorry about that.",
"知道了，不好意思。"
],
"You can sit wherever you like.": [
"Thanks! I'll take the window seat.",
"谢谢！那我坐靠窗的。"
],
"Do it the way I showed you.": [
"Okay, let me try again.",
"好，我再试一次。"
],
"You look like you haven't slept in days.": [
"Do I? I've been working late all week.",
"是吗？我这一周都在加班。"
],
"I'm thinking about changing jobs.": [
"Really? What kind of job?",
"真的？想换什么工作？"
],
"We're thinking about getting a dog.": [
"Oh, fun! What kind of dog?",
"哇，好玩！想养什么狗？"
],
"I was wondering if you could help me.": [
"Sure, what do you need?",
"当然，你需要什么？"
],
"I was wondering if you're free this weekend.": [
"Yeah, I'm free. What's up?",
"有空，怎么了？"
],
"Would you mind closing the window?": [
"Not at all. It's a little chilly.",
"不介意，是有点冷。"
],
"Would you mind waiting a few minutes?": [
"No problem. Take your time.",
"没问题，你慢慢来。"
],
"I'd rather stay home tonight.": [
"Me too. Let's order in.",
"我也是，叫外卖吧。"
],
"I'd rather walk than take the bus.": [
"Me too. It's a nice day for it.",
"我也是，今天天气适合走走。"
],
"It depends on how much it costs.": [
"Let's check the price first.",
"我们先看看价格。"
],
"It really depends on the traffic.": [
"Let's leave early, just in case.",
"那我们早点出发，以防万一。"
],
"I'm used to getting up early.": [
"Lucky you. I'm not a morning person.",
"你真好，我可起不来。"
],
"I'm not used to the cold yet.": [
"You'll get used to it.",
"你会慢慢习惯的。"
],
"I used to live in Chicago.": [
"Oh, cool. Did you like it there?",
"哦，不错，你喜欢那儿吗？"
],
"I used to hate vegetables.": [
"And now you love them?",
"那你现在爱吃了？"
],
"It takes me an hour to get to work.": [
"That's a long commute.",
"通勤时间够长的。"
],
"It took a while to get used to it.": [
"Change always takes time.",
"改变总需要时间。"
],
"I'm looking forward to seeing you.": [
"Me too! It's been way too long.",
"我也是！太久没见了。"
],
"We're really looking forward to the weekend.": [
"Any big plans?",
"有什么大计划吗？"
],
"Do you happen to know where the restroom is?": [
"It's down the hall on the left.",
"走廊尽头左手边。"
],
"Do you happen to have a pen?": [
"Yeah, here you go.",
"有，给你。"
],
"How come you didn't call me?": [
"Sorry, my phone died.",
"抱歉，我手机没电了。"
],
"How come she's not here yet?": [
"She's probably stuck in traffic.",
"她可能堵在路上了。"
],
"What if it rains tomorrow?": [
"Then we'll just stay inside.",
"那我们就待在室内。"
],
"What if we just leave early?": [
"Good idea. Let's beat the traffic.",
"好主意，避开堵车。"
],
"I can't help laughing when I see him.": [
"He's just so funny.",
"他太搞笑了。"
],
"I couldn't help thinking about it.": [
"Try not to stress about it.",
"别太为这事焦虑。"
],
"It's worth trying at least once.": [
"You only live once, right?",
"人生就一次嘛，对吧？"
],
"That movie is definitely worth watching.": [
"I'll add it to my list.",
"我把它加进片单里。"
],
"I ended up staying home.": [
"Honestly, that sounds kind of nice.",
"说实话，那听着也挺好。"
],
"We ended up getting lost.": [
"Oh no! How'd you find your way back?",
"糟糕！那你们怎么找回来的？"
],
"If I were you, I'd take the job.": [
"You really think so?",
"你真这么觉得？"
],
"If I were you, I wouldn't worry about it.": [
"Thanks. That makes me feel better.",
"谢谢，这样我好受多了。"
],
"I should have listened to you.": [
"It's okay. Next time, right?",
"没事，下次注意就好。"
],
"You should've told me earlier.": [
"Sorry, I totally forgot.",
"抱歉，我完全忘了。"
],
"We're supposed to be there at eight.": [
"Then we'd better get going.",
"那我们得出发了。"
],
"It's supposed to rain tomorrow.": [
"I'll bring an umbrella.",
"那我带把伞。"
],
"You'd better hurry up.": [
"Okay, I'm coming!",
"好，我来了！"
],
"We'd better not be late.": [
"Let's leave in five minutes.",
"那五分钟后出发。"
],
"I can't stand waiting in line.": [
"Same here. It's such a waste of time.",
"我也是，太浪费时间了。"
],
"She can't stand people who lie.": [
"I don't blame her.",
"这不怪她。"
],
"I'm too tired to go out.": [
"Okay, let's just stay in.",
"好吧，那就待在家里。"
],
"It's too hot to sleep.": [
"Yeah, I'll just turn on the fan.",
"是啊，我开个风扇吧。"
],
"Is it warm enough to swim?": [
"I think so. The water's pretty nice.",
"应该行，水挺舒服的。"
],
"She's old enough to make her own decisions.": [
"You're right. She can handle it.",
"你说得对，她能自己处理。"
],
"Let's walk instead of taking a cab.": [
"Sure, it's a nice night.",
"好啊，今晚天气不错。"
],
"Instead of complaining, do something about it.": [
"You're right. I'll start today.",
"你说得对，我今天就开始。"
],
"Call me as soon as you land.": [
"Will do. Wish me luck.",
"好的，祝我好运。"
],
"I'll let you know as soon as I hear back.": [
"Thanks, I'll be waiting.",
"谢谢，我等你消息。"
],
"Make sure you lock the door.": [
"Don't worry, I always do.",
"放心，我每次都锁。"
],
"Make sure to bring your ID.": [
"Got it. Anything else?",
"知道了，还有别的吗？"
],
"Feel free to ask me anything.": [
"Thanks, I will.",
"谢谢，我会的。"
],
"Feel free to grab a drink.": [
"Thanks! Don't mind if I do.",
"谢谢！那我不客气了。"
],
"The thing is, I don't have enough time.": [
"Maybe we can push the deadline.",
"也许我们可以把截止日期往后推。"
],
"The thing is, she never told me.": [
"Seriously? Then how was I supposed to know?",
"真的吗？那我怎么会知道？"
],
"It's not that I don't like it, it's just that it's too expensive.": [
"Yeah, it's pretty pricey.",
"是啊，确实挺贵的。"
],
"It's not that I'm mad, it's just that I'm tired.": [
"Okay. Get some rest.",
"好吧，好好休息。"
],
"It turns out he was right all along.": [
"I hate it when that happens.",
"最讨厌这种时候了。"
],
"It turned out to be a great idea.": [
"Yep. I'm glad you thought of it.",
"是啊，幸好你想到了。"
],
"No matter what happens, I'll be there.": [
"That means a lot. Thank you.",
"这对我意义很大，谢谢你。"
],
"No matter how hard I try, I can't do it.": [
"Maybe try a different approach.",
"也许换个方法试试。"
],
"You can stay as long as you want.": [
"That's so nice of you.",
"你太好了。"
],
"As long as you're happy, I'm happy.": [
"Aw, that's sweet.",
"哎呀，真暖心。"
],
"The more I think about it, the less I like it.": [
"Agreed. Let's go now.",
"同意，我们现在就走。"
],
"The sooner, the better.": [
"Exactly. Let's get it over with.",
"没错，赶紧弄完吧。"
],
"I wish I had more free time.": [
"Me too. I'm always so busy.",
"我也想，我总是太忙。"
],
"I wish I could speak French.": [
"You could take a class.",
"你可以去上个课。"
],
"What I mean is, we need more time.": [
"Okay, how much more?",
"好，还需要多久？"
],
"What I'm trying to say is, I'm sorry.": [
"It's okay. I forgive you.",
"没关系，我原谅你了。"
],
"Even though it was raining, we went out.": [
"You guys are brave.",
"你们真勇敢。"
],
"I still love it, even though it's old.": [
"Some things never get old.",
"有些东西永远不过时。"
],
"I'll be there unless something comes up.": [
"Okay, let me know either way.",
"好，不管怎样都告诉我一声。"
],
"You won't get better unless you practice.": [
"I know. I'll keep at it.",
"我知道，我会坚持的。"
],
"Take an umbrella in case it rains.": [
"Good idea. It looks cloudy.",
"好主意，看着要阴天。"
],
"Here's my number, just in case.": [
"Thanks. I'll save it.",
"谢谢，我存一下。"
],
"By the time we got there, the store was closed.": [
"Ugh, that's so annoying.",
"唉，太烦了。"
],
"By the time you read this, I'll be gone.": [
"That sounds so dramatic.",
"听着好戏剧化。"
],
"I'd appreciate it if you could keep this quiet.": [
"Don't worry, I won't tell anyone.",
"放心，我不会告诉别人的。"
],
"I'd really appreciate it if you called me back.": [
"Sure, I'll call you after work.",
"好，我下班给你回电话。"
],
"It's about time you got here!": [
"Sorry! Traffic was terrible.",
"抱歉！路上堵得厉害。"
],
"It's about time we took a vacation.": [
"I couldn't agree more.",
"我太同意了。"
],
"What's the point of arguing?": [
"You're right. Let's just drop it.",
"你说得对，算了吧。"
],
"What's the point of going if we're late?": [
"Good point. Let's just stay home.",
"说得对，我们就待在家吧。"
],
"There's no way I'm doing that.": [
"Come on, it'll be fun.",
"来嘛，会很好玩的。"
],
"There's no way we'll finish today.": [
"Not if we work late.",
"加个班就不一定了。"
],
"It seems like everyone's busy today.": [
"Yeah, it's been a crazy day.",
"是啊，今天忙疯了。"
],
"It seems like a good deal.": [
"Let's grab it before it's gone.",
"趁还没卖完赶紧拿下。"
],
"I'm about to leave. Can I call you later?": [
"Sure, no rush.",
"好，不着急。"
],
"The movie's about to start.": [
"Quick, turn off your phone.",
"快，把手机关了。"
],
"She's not only smart but also really funny.": [
"She sounds like a keeper.",
"听起来她可值得珍惜。"
],
"It's not only cheap, but it also tastes great.": [
"No wonder there's always a line.",
"难怪总排长队。"
],
"Whether or not you agree, we're going.": [
"Fine. I'll get my coat.",
"好吧，我去拿外套。"
],
"I'm not sure whether or not he's coming.": [
"Let me text him and ask.",
"我发消息问问他。"
],
"I can barely cook rice, let alone a full meal.": [
"Don't worry, I'll teach you.",
"别担心，我教你。"
],
"He can't afford a car, let alone a house.": [
"Yeah, rent here is crazy.",
"是啊，这儿房租太离谱了。"
],
"It's up to you. I'm fine either way.": [
"Okay, let's do Thai food.",
"好，那就吃泰国菜。"
],
"It's up to you to decide.": [
"Give me a day to think about it.",
"给我一天时间考虑。"
],
"Little did I know, she was planning a surprise party.": [
"Aw, did you cry?",
"哇，你哭了吗？"
],
"Little did we know how hard it would be.": [
"But we made it through.",
"但我们还是挺过来了。"
],
"No sooner had I sat down than the phone rang.": [
"Isn't that always the way?",
"不总是这样吗？"
],
"No sooner had we arrived than it started to rain.": [
"Typical. Did you get wet?",
"老样子，你淋湿了吗？"
],
"Not until I moved here did I realize how much I missed home.": [
"That happens to a lot of people.",
"很多人都这样。"
],
"Not until later did he admit it.": [
"At least he finally told the truth.",
"至少他最终说了实话。"
],
"It's high time you started saving money.": [
"I know. I'll start next month.",
"我知道，我下个月就开始。"
],
"It's high time we talked about this.": [
"Okay, let's sit down after dinner.",
"好，晚饭后我们坐下来聊聊。"
],
"Given the weather, let's stay in.": [
"Good idea. Movie night?",
"好主意，看电影吧？"
],
"Given that he's new, he's doing great.": [
"Yeah, he's a fast learner.",
"是啊，他学得很快。"
],
"Rather than complaining, let's fix it.": [
"I'm with you. Let's get to work.",
"我赞成，开干吧。"
],
"I'd rather call than text.": [
"Me too. It's quicker.",
"我也是，打电话快。"
],
"As far as I'm concerned, it's a waste of time.": [
"Fair enough. Let's skip it.",
"也对，那就不去了。"
],
"As far as I know, the meeting's still on.": [
"Great, I'll see you there.",
"好，到时见。"
],
"The way I see it, we don't have a choice.": [
"Then let's make the best of it.",
"那我们就尽力而为吧。"
],
"The way I see it, it's a win-win.": [
"Sounds like a good deal to me.",
"我觉得这买卖划算。"
],
"It goes without saying that safety comes first.": [
"Of course. Always.",
"当然，永远如此。"
],
"It goes without saying, you're invited.": [
"Aw, thanks! I'll be there.",
"哇，谢谢！我一定到。"
],
"Be that as it may, we still need a plan.": [
"You're right. Let's make one now.",
"你说得对，我们现在就定一个。"
],
"It's expensive. Be that as it may, it's worth it.": [
"Agreed. It'll last for years.",
"同意，能用好多年呢。"
],
"I'm not sure if I can make it.": [
"Try your best. It'd be great to see you.",
"尽量来吧，很想见你。"
],
"I'm pretty sure he's joking.": [
"Yeah, he always does that.",
"是啊，他总这样。"
],
"Why don't we order pizza tonight?": [
"Sure! Pepperoni?",
"好啊！要意式辣香肠的？"
],
"Why don't you take a day off?": [
"Maybe I will. I need a break.",
"也许真该休一天，我需要歇歇。"
],
"How about meeting at six?": [
"Six works for me.",
"六点可以。"
],
"How about we just stay in?": [
"Fine by me. I'm tired anyway.",
"我没意见，反正我也累了。"
],
"Let's not talk about work.": [
"Deal. No work talk tonight.",
"一言为定，今晚不聊工作。"
],
"Let's not make a big deal out of it.": [
"You're right. It's not that serious.",
"你说得对，没那么严重。"
],
"It's not easy to make friends here.": [
"Yeah, it takes time.",
"是啊，需要时间。"
],
"It's easy to get lost in this city.": [
"Just use your phone's map.",
"用手机地图就好。"
],
"I have trouble sleeping lately.": [
"Have you tried cutting out caffeine?",
"你试过戒咖啡因吗？"
],
"She has trouble remembering names.": [
"Same here. I'm terrible with names.",
"我也是，我特别记不住名字。"
],
"I'm really into hiking these days.": [
"Nice! Where do you usually go?",
"不错！你一般去哪儿？"
],
"I'm not really into horror movies.": [
"Me neither. They're too scary.",
"我也不喜欢，太吓人了。"
],
"What do you think of my new haircut?": [
"I love it! It really suits you.",
"我很喜欢！特别适合你。"
],
"What do you think about moving to Tokyo?": [
"That's a big move. Are you sure?",
"这可是大决定，你确定吗？"
],
"Is it okay if I sit here?": [
"Of course. Go ahead.",
"当然，坐吧。"
],
"Is it okay if I bring a friend?": [
"Sure, the more the merrier.",
"当然，人越多越热闹。"
],
"I'm sorry to hear that you're sick.": [
"Thanks. I'm feeling a bit better now.",
"谢谢，我现在好一点了。"
],
"I'm so sorry to hear about your dad.": [
"Thank you. It's been a hard week.",
"谢谢你，这周真的很难熬。"
],
"It's time to go home.": [
"Already? Okay, let me grab my coat.",
"这么快？好，我拿下外套。"
],
"It's time for a change.": [
"Agreed. I'm ready for something new.",
"同意，我准备好迎接新东西了。"
],
"There's no need to apologize.": [
"Okay, thanks for understanding.",
"好，谢谢你理解。"
],
"There's no need to rush.": [
"Thanks. I'll take my time.",
"谢谢，那我慢慢来。"
],
"I didn't mean to hurt your feelings.": [
"I know. It's okay.",
"我知道，没事的。"
],
"Sorry, I didn't mean to interrupt.": [
"No problem. Go ahead.",
"没关系，你说。"
],
"I can't believe it's already Friday.": [
"I know! This week flew by.",
"是啊！这周过得好快。"
],
"I can't believe you remembered!": [
"Of course I did!",
"我当然记得！"
],
"No wonder you're tired. You worked all night.": [
"Yeah, I need some sleep.",
"是啊，我得睡一觉。"
],
"It's no wonder she's upset.": [
"Should we go talk to her?",
"我们要不要去跟她聊聊？"
],
"I'm not in the mood for a party.": [
"No worries. Maybe next time.",
"没事，下次吧。"
],
"I'm not in the mood to argue.": [
"Okay, let's drop it.",
"好，那就不说了。"
],
"You might want to bring a jacket.": [
"Good call. It's getting cold.",
"说得对，天变冷了。"
],
"You might want to double-check that.": [
"Good idea. I'll check it again.",
"好主意，我再查一遍。"
],
"It never hurts to ask.": [
"True. The worst they can say is no.",
"确实，大不了被拒绝。"
],
"It never hurts to have a backup plan.": [
"Good thinking.",
"想得周到。"
],
"I could really use a coffee right now.": [
"Same. Let's grab one.",
"我也是，去买一杯吧。"
],
"I could use some help with this.": [
"Sure, what do you need?",
"好，需要我帮什么？"
],
"I'm on the fence about buying a new phone.": [
"Maybe wait for the new model.",
"也许等等新款。"
],
"We're still on the fence about the trip.": [
"Let me know when you decide.",
"决定了告诉我。"
],
"Speaking of food, I'm starving.": [
"Same. Let's eat.",
"我也是，吃饭吧。"
],
"Speaking of which, did you call your mom?": [
"Oh, I totally forgot!",
"哎呀，我完全忘了！"
],
"It's not like I have a choice.": [
"I know. It's tough.",
"我知道，挺难的。"
],
"It's not like it's the end of the world.": [
"Exactly. We'll figure it out.",
"没错，我们会想到办法的。"
],
"I'd be lying if I said I wasn't nervous.": [
"You'll do great. Don't worry.",
"你会表现很好的，别担心。"
],
"I'd be lying if I said I didn't miss it.": [
"Then maybe you should go back.",
"那也许你该回去看看。"
],
"For what it's worth, I think you did the right thing.": [
"Thanks. That makes me feel better.",
"谢谢，这样我好受多了。"
],
"For what it's worth, I'm on your side.": [
"Thank you. That means a lot.",
"谢谢你，这对我很重要。"
],
"It's expensive, not to mention really far.": [
"Yeah, let's find somewhere closer.",
"是啊，找个近点的吧。"
],
"He's smart, not to mention super kind.": [
"He's a great guy.",
"他人特别好。"
],
"If you need anything, just let me know.": [
"Thanks, I will.",
"谢谢，我会的。"
],
"If it rains, we'll stay inside.": [
"Sounds like a plan.",
"就这么定了。"
],
"If I had more money, I'd travel the world.": [
"Me too. Maybe someday.",
"我也想，也许有一天吧。"
],
"What would you do if you won the lottery?": [
"I'd pay off my parents' house.",
"我会把我爸妈的房贷还清。"
],
"If I'd known, I would've come earlier.": [
"It's okay. You're here now.",
"没关系，你现在来了就好。"
],
"If we hadn't left early, we would've missed the flight.": [
"Phew, that was close.",
"呼，好险。"
],
"If I'd taken that job, I'd be living in New York now.": [
"Do you ever regret it?",
"你后悔过吗？"
],
"If she weren't so busy, she would've called you.": [
"I understand. Tell her not to worry.",
"我理解，让她别担心。"
],
"It was Mike who broke the window.": [
"Seriously? Did he say sorry?",
"真的吗？他道歉了吗？"
],
"It's not the money that bothers me, it's the attitude.": [
"I totally get it.",
"我完全理解。"
],
"What I need right now is a long vacation.": [
"You've earned it.",
"这是你应得的。"
],
"What really surprised me was how friendly everyone was.": [
"That's so nice to hear.",
"听到这个真好。"
],
"That's the guy who helped me move.": [
"Oh, I remember him. He was so nice.",
"哦，我记得他，人特别好。"
],
"This is the café where we first met.": [
"Aw, it hasn't changed at all.",
"哇，一点都没变。"
],
"He showed up two hours late, which was really annoying.": [
"I'd be annoyed too.",
"换我也会很烦。"
],
"My sister, who lives in Boston, is visiting next week.": [
"That's great! You must be excited.",
"太好了！你一定很期待。"
],
"The meeting has been moved to Friday.": [
"Thanks for the heads-up.",
"谢谢提醒。"
],
"I got stuck in traffic for an hour.": [
"Ugh, rush hour is the worst.",
"唉，高峰期最糟了。"
],
"I need to get my hair cut.": [
"I know a great place nearby.",
"我知道附近有家很好的。"
],
"We had the car fixed last week.": [
"Is it running okay now?",
"现在开起来没问题了吧？"
],
"My boss made me work late.": [
"That's not fair. Did you get overtime?",
"这不公平，有加班费吗？"
],
"Let me know what you think.": [
"I'll think it over and get back to you.",
"我考虑一下再回复你。"
],
"Do you know where the station is?": [
"Yeah, it's just around the corner.",
"知道，就在拐角那儿。"
],
"I'm not sure what time it starts.": [
"Let me check the website.",
"我上网查一下。"
],
"She said she'd be here by six.": [
"Then she should be here any minute.",
"那她应该马上就到了。"
],
"He told me he was quitting.": [
"Really? Did he say why?",
"真的？他说为什么了吗？"
],
"I've been waiting for twenty minutes.": [
"Sorry! I'm almost there.",
"抱歉！我快到了。"
],
"How long have you been learning English?": [
"About two years now.",
"大概两年了。"
],
"When I got home, everyone had already eaten.": [
"Oh no. Is there anything left?",
"啊，还有剩的吗？"
],
"I'd never seen snow before I moved here.": [
"What was it like the first time?",
"第一次见是什么感觉？"
],
"This time tomorrow, I'll be lying on a beach.": [
"Lucky you! Send me pictures.",
"真羡慕你！记得发照片给我。"
],
"Will you be using the car tonight?": [
"No, go ahead and take it.",
"不用，你开走吧。"
],
"You must be tired after that flight.": [
"I'm exhausted. I need a nap.",
"累死了，我得睡一会儿。"
],
"He might have missed the bus.": [
"Maybe. He's usually on time.",
"有可能，他一般都很准时。"
],
"It's not as hard as I thought.": [
"Told you you could do it.",
"我就说你能行吧。"
],
"This one is way cheaper than that one.": [
"Then let's get the cheaper one.",
"那就买便宜的吧。"
],
"Feeling tired, I went to bed early.": [
"Good call. Did you sleep well?",
"明智，你睡得好吗？"
],
"Having finished the report, she went home.": [
"She must've been relieved.",
"她肯定松了口气。"
],
"I'm starving. So am I.": [
"Let's go grab something to eat.",
"那我们去吃点东西吧。"
],
"I haven't seen it yet. Neither have I.": [
"Let's watch it together this weekend.",
"那这周末一起看吧。"
],
"Never have I seen anything like it.": [
"Me neither. It's incredible.",
"我也没见过，太不可思议了。"
],
"Rarely do we get a whole day off.": [
"Then let's make the most of it.",
"那就好好利用这一天吧。"
],
"I wish you were here.": [
"Me too. Next time, come with me.",
"我也是，下次一起来。"
],
"If only I'd listened to you.": [
"It's okay. Everyone makes mistakes.",
"没事，谁都会犯错。"
],
"I suggest that he take a break.": [
"Good idea. He looks exhausted.",
"好主意，他看起来累坏了。"
],
"She insisted that we stay for dinner.": [
"That was so sweet of her.",
"她人太好了。"
],
"Learning a language takes time.": [
"True. You just have to keep at it.",
"没错，只要坚持就行。"
],
"Working from home has its pros and cons.": [
"True. I miss my coworkers, though.",
"确实，不过我挺想同事们的。"
]
};
const EX_REPLY_ZH = {
"Yeah, I'm right by the pharmacy.": "对，我就在药店旁边。",
"Sure, but there's a toll.": "可以，但要交过路费。",
"About twenty minutes with traffic.": "算上堵车大概二十分钟。",
"No problem, I'll pull up right there.": "没问题，我就停那儿。",
"Sure, let me know if it gets too cold.": "好的，太冷了就跟我说。",
"Go ahead.": "请便。",
"Cash or card, either works.": "现金刷卡都行。",
"Thanks, appreciate it.": "谢谢，感激不尽。",
"I'll get you there as fast as I can.": "我尽快送你到。",
"You got it. Have a good one.": "好嘞，祝你愉快。",
"Straight ahead, past security.": "一直往前走，过了安检就是。",
"Sure, let me see what's available.": "好的，我看看还有什么空位。",
"Just one, and this one's carry-on.": "就一件，这件是随身带的。",
"Yeah, it starts over there.": "对，就从那边开始排。",
"Yes, and your liquids too.": "对，液体也要拿出来。",
"It's B12, boarding in forty minutes.": "B12 登机口，四十分钟后登机。",
"It's delayed about twenty minutes.": "晚点了大概二十分钟。",
"Let me check. Yes, I can move you.": "我查一下。可以，能给您换。",
"Baggage claim is downstairs, carousel three.": "行李提取在楼下，三号转盘。",
"Let's file a report right now.": "我们现在就登记报失吧。",
"Any fever or cough?": "有发烧或者咳嗽吗？",
"Let me take a look.": "我看一下。",
"Good to know. I'll prescribe something else.": "好的，那我给你换别的药。",
"Yes, with food, twice a day.": "对，饭后吃，一天两次。",
"You should feel better in two or three days.": "两三天就会好些。",
"I'd rest for a day or two.": "我建议休息一两天。",
"Let's run a quick blood test.": "我们先快速验个血。",
"If it's not better in a week, yes.": "一周还不见好的话，要来。",
"Skip alcohol and get plenty of sleep.": "别喝酒，多睡觉。",
"Take care, and call if it gets worse.": "保重，加重了就打电话。",
"Yes, this one works well at night.": "有，这个晚上用效果很好。",
"A little, so take it before bed.": "有一点，所以睡前吃。",
"Every six hours, as needed.": "需要的话每六小时一次。",
"Yes, it's half the price.": "对，价格只要一半。",
"Not for this one.": "这个不用。",
"Better to check with your doctor.": "最好问问你的医生。",
"Try these; they're gentle.": "试试这个，比较温和。",
"This one's for adults only.": "这个只适合成人。",
"Two tablets, twice a day.": "一次两片，一天两次。",
"You're welcome. Feel better soon.": "不客气，早日康复。",
"Great, let me show you our plans.": "好的，我给你介绍一下我们的套餐。",
"There's a one-time fee of thirty dollars.": "有一次性三十美元的费用。",
"Yes, for up to two months a year.": "可以，一年最多冻结两个月。",
"Five in the morning to eleven at night.": "早上五点到晚上十一点。",
"We do, starting at fifty an hour.": "有，每小时五十起。",
"Yes, it's included in every plan.": "有，每个套餐都包含。",
"Sure, the first week's free.": "可以，第一周免费。",
"Down the hall, past the weights.": "沿走廊过了器械区就是。",
"No worries, we'll start you slow.": "没关系，我们会让你慢慢来。",
"All of them, except the specialty ones.": "都可以，除了特色课程。",
"How much off the sides?": "两边剪多少？",
"Like this? Let me know if it's too much.": "这样行吗？太多了跟我说。",
"Sure, I'll just clean up the edges.": "好的，我就修修边。",
"High fade or low fade?": "高渐变还是低渐变？",
"We do, want me to put some in?": "有，要给你抹点吗？",
"About twenty-five minutes.": "大概二十五分钟。",
"Sure, same time?": "好的，还是这个时间吗？",
"Sorry, I can even it out.": "抱歉，我给你修齐。",
"Twenty-five, cash or card.": "二十五块，现金还是刷卡？",
"Anytime. See you next month.": "随时欢迎，下个月见。",
"Sure, do you have your ID with you?": "好的，带身份证了吗？",
"There's no minimum on this one.": "这个没有最低存款要求。",
"Not if you set up direct deposit.": "设置工资自动存入就不收。",
"We can print a new one today.": "今天就能给你打一张新的。",
"You're at twelve hundred and forty.": "你的余额是一千二百四十。",
"How much, and to which account?": "转多少，转到哪个账户？",
"Let me look that up for you.": "我帮你查一下。",
"It's on the board behind you.": "在你身后的牌子上。",
"It's free for members.": "会员免费。",
"Happy to help. Anything else?": "很乐意帮忙，还有别的吗？",
"Pretty good, you?": "挺好的，你呢？",
"Yeah, it woke me up too.": "是啊，我也被吵醒了。",
"I do, I'll text you his number.": "有，我把他电话发你。",
"Of course, sorry about that.": "当然，不好意思。",
"Thanks for the heads-up.": "谢谢提醒。",
"Sure, I'll bring it over tonight.": "好，我今晚给你拿过去。",
"About three years now.": "大概三年了。",
"I know, I filed a complaint.": "我知道，我已经投诉了。",
"That's really nice of you.": "你真好。",
"Take care!": "保重！",
"Yeah, cars are so expensive these days.": "是啊，现在车太贵了。",
"Nice! I hope she gets it.": "不错！希望她能拿到。",
"Mine too. It's pretty common.": "我爸妈也是，很常见。",
"Great, just send me the time.": "好，把时间发我就行。",
"Yeah, I wouldn't miss it.": "去啊，我可不会错过。",
"Smart. Traffic is a nightmare.": "明智，堵车太可怕了。",
"Sure, here you go.": "当然，给你。",
"Maybe he should just quit.": "也许他该辞职算了。",
"Yeah, I think about it all the time.": "想过，我经常想这事。",
"Perfect, I'll be home all day.": "太好了，我那天一整天都在家。",
"That's awesome. You should listen to her.": "太好了，你该听她的。",
"Me neither. It's crazy in here.": "我也没想到，这里人太多了。",
"I can tell! You sound great.": "听得出来！你说得很好。",
"No, tax is extra.": "不含，税另算。",
"Nice job! That's impressive.": "干得好！真厉害。",
"Really? Where's she moving to?": "真的吗？她要搬去哪儿？",
"That was nice of him.": "他人真好。",
"Me too. Coffee makes me jittery.": "我也是，喝咖啡我会心慌。",
"Yeah, especially in winter.": "是啊，冬天尤其要洗。",
"Time flies when you're having fun.": "开心的时候时间过得快嘛。",
"Sure, there's a great taco place nearby.": "可以，附近有家很棒的塔可店。",
"Same here. It's so hard.": "我也是，太难了。",
"I don't blame her. It was too personal.": "不怪她，那问题太私人了。",
"Sure, I'll remind you after dinner.": "好，吃完饭我提醒你。",
"There's a repair shop down the street.": "这条街上就有家修手机的。",
"That sounds exhausting.": "听着就累。",
"Good idea. Traffic might be bad.": "好主意，可能会堵车。",
"Thanks. I usually am.": "谢啦，我一般都对。",
"That bad, huh?": "有那么糟啊？",
"Why don't you text her?": "你给她发个消息呗。",
"Congrats! Drinks are on me.": "恭喜！我请大家喝一杯。",
"It's okay. We all make mistakes.": "没事，谁都会犯错。",
"No problem. Anytime.": "不客气，随时找我。",
"Sounds great. Where should we go?": "好啊，去哪儿？",
"I know, but it's hard not to.": "我知道，可是很难做到。",
"Let's check the forecast.": "那我们看看天气预报。",
"Good for her!": "她真厉害！",
"Sounds fun. What was your favorite part?": "听着不错，你最喜欢哪儿？",
"I don't blame you.": "不怪你。",
"Oh yeah? What's he like?": "是吗？他人怎么样？",
"Sure, just pay me back Friday.": "行，周五还我就好。",
"Nice! How'd you do it?": "厉害！你怎么做到的？",
"Thanks. That means a lot.": "谢谢，这对我很重要。",
"Yeah, she always tells it like it is.": "是啊，她向来有话直说。",
"Sure, but no pineapple.": "好啊，但别放菠萝。",
"Agreed. Let's get everyone together.": "同意，把大家叫到一起吧。",
"You're right. It's not worth it.": "你说得对，不值得。",
"Thanks. I really need one.": "谢谢，我真的需要歇歇。",
"Yeah, he's always late.": "是啊，他总迟到。",
"Yeah, I think I've got it.": "可以，我应该能搞定。",
"Here, let me show you.": "来，我给你演示一下。",
"She's always so creative.": "她一直很有创意。",
"Wow, you must've had fun.": "哇，你们一定玩得很开心。",
"I'll grab some on my way home.": "我回家路上买点。",
"Yeah, we get along great.": "处得来，我们关系很好。",
"Me too! It's gonna be amazing.": "我也是！一定会很棒。",
"Okay, okay. I'll start now.": "好啦好啦，我现在就写。",
"You're right. I'll give it another shot.": "你说得对，我再试一次。",
"That's amazing! Congratulations!": "太棒了！恭喜你！",
"Great, I'll be ready.": "好，我会准备好的。",
"Really? That's not like him.": "真的吗？这不像他啊。",
"Wow, why'd she do that?": "哇，她为什么拒绝？",
"Thanks. I hope you're right.": "谢谢，希望你说得对。",
"Oh yeah? What's good there?": "是吗？那儿什么好喝？",
"Sure! What do you wanna do?": "好啊！你想干嘛？",
"I'd love that. How about Saturday?": "好啊，周六怎么样？",
"Great, thanks for checking.": "好的，谢谢你帮忙查。",
"You're a lifesaver.": "你真是救星。",
"Ugh, I know the feeling.": "唉，我懂那种感觉。",
"Glad you're feeling better now.": "你现在好些了就好。",
"Sorry, I just got a little stressed.": "抱歉，我刚才有点紧张。",
"Sure, hand it over.": "行，拿过来吧。",
"Small world! Did she remember you?": "世界真小！她还记得你吗？",
"Good call. It always turns into a fight.": "说得对，一提准吵起来。",
"I'm sorry to hear that. Is she okay?": "听着真难过，她还好吗？",
"Good for you. That's not easy.": "真不错，这可不容易。",
"That's good. They're cute together.": "那就好，他俩挺配的。",
"Sure. Do you have a pen?": "好的，有笔吗？",
"Nice! How many times a week?": "不错！一周几次？",
"Take your time.": "不着急。",
"Sure, I'm all ears.": "当然，你说吧。",
"I'll bring an umbrella then.": "那我带把伞。",
"Yeah, I guess you're right.": "嗯，你说得对吧。",
"I think you made the right call.": "我觉得你做得对。",
"I'm so glad you got to do it.": "真为你能去体验高兴。",
"I wanna run a half marathon.": "我想跑个半马。",
"I know. I'm trying to stop.": "我知道，我在努力改。",
"Yeah, I agree. Let's look around.": "我同意，我们再看看别家。",
"I know. I'm really excited about it.": "我知道，我特别兴奋。",
"What are you gonna do?": "那你打算怎么办？",
"True. The winters are so mild.": "确实，冬天很暖和。",
"Yeah, she's always so upbeat.": "是啊，她总是很乐观。",
"Okay, that gives us a week.": "好，那我们还有一周时间。",
"Yeah, one item is missing.": "有，少了一件东西。",
"Okay, let's just stay in tonight.": "好吧，那今晚就待在家里。",
"Let's hear them.": "说来听听。",
"We're planning the new project.": "我们要规划新项目。",
"Let's meet next week, then.": "那我们下周见吧。",
"Have you thought about taking some time off?": "你有没有想过休个假？",
"Happy to help.": "很乐意帮忙。",
"Yeah, after two works for me.": "有，两点以后我都行。",
"No worries. We just found out too.": "没事，我们也是刚发现。",
"Yeah, she really owns the room.": "是啊，她一出场就镇得住。",
"Tuesday works great.": "周二很合适。",
"Same. It felt kind of rushed.": "我也是，感觉有点草草收场。",
"Don't worry, everyone does it.": "别在意，谁都摔过。",
"It was really popular a few years ago.": "几年前这首歌很火。",
"Thanks, I worked really hard on it.": "谢谢，我下了很大功夫。",
"You think so? I had no idea.": "你这么觉得？我完全没发现。",
"Thanks. I'll keep at it.": "谢谢，我会坚持的。",
"Yeah, let's go for it.": "嗯，那就买吧。",
"I need to book one too.": "我也得去约一个。",
"Sorry, that was me. I'll clean it up.": "抱歉，是我，我来收拾。",
"I know. I'll apologize to her.": "我知道，我会去跟她道歉。",
"I'll have to go see it myself.": "我得亲自去看看。",
"No problem. What do you want instead?": "没问题，那你想要什么？",
"No worries. Just text me when you're close.": "没事，快到了给我发个消息。",
"Me too. They're so sweet.": "我也是，芒果好甜。",
"Yeah, I just saw a great one last night.": "看了，昨晚刚看了一部很好的。",
"Good. We really need him.": "太好了，我们真的需要他。",
"That's so typical of him.": "他就是这样。",
"I bet. It's really different here.": "我能想象，这儿差别挺大的。",
"It's a good problem to have.": "这是个甜蜜的烦恼。",
"Nope, I was just in the back.": "没有，我刚才在后面。",
"Sure. Let me explain.": "好，我解释一下。",
"That's okay. No pressure.": "没关系，别有压力。",
"It was a real team effort.": "这真是大家一起努力的结果。",
"Awesome! You won't regret it.": "太好了！你不会后悔的。",
"I go running every morning.": "我每天早上去跑步。",
"Then let him cook for once.": "那就让他做一回饭。",
"Got it. We'll take it seriously.": "明白，我们会认真对待。",
"Don't worry, I'll double-check.": "别担心，我再检查一遍。",
"Good idea. Like what?": "好主意，比如说？",
"Sounds good. Let's put it on the calendar.": "好，我们记到日程上。",
"Thanks, I really appreciate it.": "谢谢，真的很感激。",
"No, that's not what I meant.": "不是，我不是那个意思。",
"It's an investment. Trust me.": "这是投资，相信我。",
"Yeah, especially with all the snacks around.": "是啊，尤其是身边全是零食。",
"Nice! How much did you save?": "不错！省了多少？",
"Good for her. That takes guts.": "真为她高兴，这需要勇气。",
"Bummer. When's the new date?": "真扫兴，改到哪天了？",
"You're right. I'll slow down.": "你说得对，我会放慢节奏。",
"That's brave. I hope it works out.": "真有勇气，希望他成功。",
"It's never too late to start.": "什么时候开始都不晚。",
"Great work, everyone.": "大家干得好。",
"Don't worry, I'll help you catch up.": "别担心，我帮你赶上。",
"Same. I'm working on it.": "我也是，我在改。",
"Let's start with the easy parts.": "先从简单的部分下手吧。",
"Sorry, I'll leave you alone.": "抱歉，我不吵你了。",
"Thank goodness. I was worried.": "谢天谢地，我还担心呢。",
"That's why we double-check everything.": "所以我们每样都要复查。",
"He's actually really funny once you know him.": "熟了以后他其实很逗。",
"Try writing it down first.": "先写下来试试。",
"Yeah, I expected way more.": "是啊，我期望高多了。",
"Maybe talk to your neighbors?": "要不跟邻居说说？",
"Agreed. No more changes.": "同意，不再改了。",
"Typical. He always does that.": "老样子，他总这样。",
"Try watching some shows in Spanish.": "试试看西班牙语的剧。",
"Isn't it always?": "不一向如此吗？",
"Oh no. What happened?": "啊，怎么了？",
"Okay, let's go with pizza.": "好，那就吃披萨吧。",
"I just read the headlines.": "我就只看看标题。",
"She sounds like a great role model.": "听起来她是个好榜样。",
"Let's get started right away.": "那我们马上开始吧。",
"Me neither, honestly.": "说实话，我自己也不敢信。",
"True. Let's keep an eye on it.": "确实，我们留意着。",
"No way! Were you scared?": "不会吧！你怕吗？",
"Sounds good. Thanks, everyone.": "好，谢谢大家。",
"I'm so glad it worked out.": "真高兴结果这么好。",
"Perfect, thanks.": "好的，谢谢。",
"No worries. Go ahead.": "没关系，你说吧。",
"Thanks, I'll stop by sometime.": "谢谢，我改天过去。",
"Sure, let me know what he says.": "好，他怎么说告诉我。",
"Maybe, but I think I'm right.": "也许吧，但我觉得我没错。",
"I know. I'm ready for it.": "我知道，我准备好了。",
"Fine. I'll take responsibility.": "行，我自己负责。",
"Okay, I'll try.": "好，我试试。",
"Same here. Family comes first.": "我也是，家人第一。",
"But it's so worth it.": "但非常值得。",
"Let's see if there's a cheaper option.": "看看有没有便宜点的选择。",
"Yeah, everyone loved her.": "是啊，大家都喜欢她。",
"Just be myself and stay calm.": "做自己，保持冷静。",
"Yeah, I take what he says with a grain of salt.": "是啊，他的话我都打个折听。",
"I've seen it everywhere.": "我到处都能看到。",
"Let's cook at home more, then.": "那我们多在家做饭吧。",
"Okay, what do you suggest?": "好，你有什么建议？",
"Anytime. Hope it helps.": "随时，希望有帮助。",
"Thanks, I've been thinking about it a lot.": "谢谢，我想了很久。",
"Health insurance and a gym membership.": "有医保，还有健身卡。",
"You're not a burden at all.": "你一点都不是负担。",
"Hang in there. You've got this.": "坚持住，你可以的。",
"Let's go there for your birthday.": "你生日就去那儿吧。",
"Yeah, people have strong opinions.": "是啊，大家看法都很强烈。",
"Maybe it's time for a new one.": "也许该换辆新的了。",
"Lucky you. Mine are so strict.": "你真幸运，我的特别死板。",
"True. We just have to adapt.": "没错，我们只能适应。",
"Let's take it one step at a time.": "我们一步一步来。",
"Try turning it off and on again.": "关了再开试试。",
"Of course. That's what friends are for.": "当然，朋友就该这样。",
"Yeah, nobody knew what to say.": "是啊，谁都不知道说什么。",
"Fair point. Let's move on.": "说得对，我们继续吧。",
"That's great to hear.": "太好了。",
"Good. I'll set it up myself, then.": "好，那我自己装。",
"Let's grab a drink and unwind.": "我们去喝一杯放松一下。",
"Yeah, she's one of the good ones.": "是啊，她是个好人。",
"Send it to me!": "发给我！",
"Go take a nap.": "去睡一觉吧。",
"It's nothing. I'm happy to help.": "小事，很乐意帮忙。",
"Oh no, I love that place.": "啊，我好喜欢那家店。",
"How much more?": "还需要多久？",
"Great! See you there.": "太好了！到时见。",
"Fair enough.": "好吧，可以理解。",
"I know. I'm not mad.": "我知道，我没生气。",
"Okay, take your time.": "好，你慢慢来。",
"Yep. I've had enough.": "是啊，我受够了。",
"Maybe the suburbs are a good compromise.": "也许郊区是个折中的选择。",
"I'm coming, I'm coming!": "来了来了！",
"Thanks, I'll set the table.": "谢谢，我来摆桌子。",
"That's what I call teamwork.": "这才叫团队合作。",
"Yeah, I couldn't tell what he meant.": "是啊，我听不出他什么意思。",
"Okay, let me start over.": "好，我重新说。",
"She totally changed my mind.": "她完全改变了我的看法。",
"Let's start working on it today.": "今天就开始做吧。",
"You're right. I'll try harder.": "你说得对，我会更努力。",
"Then let's take our time.": "那我们慢慢来。",
"Good. Then there's no confusion.": "好，那就不会搞错了。",
"I think so, if we plan well.": "我觉得行，只要计划好。",
"That's why I don't invest much.": "所以我投得不多。",
"That's why he's so good at his job.": "所以他工作这么出色。",
"Yeah, that makes sense.": "嗯，有道理。",
"I can tell. You've changed a lot.": "看得出来，你变了很多。",
"Let's give him some space.": "给他点空间吧。",
"I can't really tell them apart.": "我真分不出来。",
"That's totally normal.": "这很正常。",
"I might get one too.": "我可能也买一件。",
"Sure. Let me give you an example.": "好，我举个例子。",
"Sorry, that wasn't my intention.": "抱歉，我不是那个意思。",
"Thanks, doctor.": "谢谢医生。",
"Yeah, she's a natural speaker.": "是啊，她天生会说话。",
"What would you do instead?": "那你想做什么？",
"Let's wait for more information.": "等更多消息出来再说吧。",
"That'll save us a lot of time.": "这能省很多时间。",
"Maybe start with a team dinner.": "可以先从团队聚餐开始。",
"Let's start small and see how it goes.": "先小规模试试看。",
"That's a lot of pressure.": "压力好大。",
"Fair enough. Let's wait and see.": "也对，我们等等看。",
"Trust me, I won't.": "放心，我不会的。",
"What's going on?": "怎么了？",
"It could change everything.": "可能会改变一切。",
"Maybe ask your boss for a raise.": "要不找老板要求加薪。",
"Yeah, some things get lost in translation.": "是啊，有些东西一翻译就没了。",
"Yeah, but it's worth every penny.": "是啊，不过物有所值。",
"You'll bounce back in no time.": "你很快就能缓过来。",
"True. You can't have it all.": "没错，鱼和熊掌不可兼得。",
"And it paid off!": "结果成功了！",
"Slow is better than nothing.": "慢总比没有强。",
"No doubt about it.": "毫无疑问。",
"Well, that's life.": "嗯，生活就是这样。",
"I hope so. I'm getting worried.": "希望如此，我有点担心了。",
"Here, use my charger.": "给，用我的充电器吧。",
"I know. Everything costs more now.": "是啊，现在什么都更贵了。",
"Yeah, I didn't sleep much last night.": "是啊，我昨晚没怎么睡。",
"Thanks! It's my grandma's recipe.": "谢谢！这是我奶奶的配方。",
"Me too! It's so catchy.": "我也是！太上头了。",
"Wow, that's a tough language.": "哇，那门语言可不好学。",
"Sure, I'll email it to you now.": "好，我现在就发你邮箱。",
"That's sweet. Do you ride it a lot?": "真好，你经常骑吗？",
"I'm so happy for you!": "真为你高兴！",
"Okay, no problem.": "好，没问题。",
"I'm really glad it helped.": "能帮上忙我很高兴。",
"Is it? I didn't notice.": "是吗？我都没注意到。",
"Thanks! Let's give it a try.": "谢谢！那我们试试吧。",
"I think so. She said she'd try.": "应该来，她说会尽量。",
"Then let's focus on what matters most.": "那我们先抓最重要的。",
"Great, I'm glad we're on the same page.": "好，很高兴我们想法一致。",
"Me too. I'm glad we checked.": "我也是，幸好我们查了一下。",
"I get it. Trust is everything.": "我懂，信任最重要。",
"Oh, nice! Do you visit often?": "不错！你常去看他吗？",
"Oh, okay. I'll call her back.": "哦，好，我给她回电话。",
"Yep, that's the one. Enjoy!": "对，就是这本，好好看！",
"Oh no. Did you call the rental company?": "糟了，你给租车公司打电话了吗？",
"Aw, we should go back sometime.": "哇，我们改天该再去一次。",
"Me too. It feels like yesterday.": "我也记得，就像昨天一样。",
"No way! That's so cool.": "不会吧！太酷了。",
"Ugh, that would drive me crazy.": "唉，换我会被逼疯的。",
"I'd love to go there someday.": "我真想哪天也去看看。",
"Wow, what happened?": "哇，出什么事了？",
"I will. Don't worry.": "会的，别担心。",
"Thanks, it won't take long.": "谢谢，不会太久的。",
"Sounds good. I'm free after twelve.": "好啊，我十二点以后有空。",
"Okay, let me grab my bag.": "好，我拿下包。",
"Oh no. Are you feeling better now?": "啊，你现在好点了吗？",
"Sure, what do you need?": "好啊，需要我做什么？",
"Those are the best conversations.": "那种聊天最棒了。",
"Wow, you're really committed.": "哇，你真够执着的。",
"Good thinking.": "想得周到。",
"Sorry, I'll talk louder.": "抱歉，我大声点。",
"You must have been exhausted.": "你一定累坏了。",
"Sounds perfect. Did you swim?": "听着太完美了，你下水了吗？",
"Things usually do.": "事情通常都是这样。",
"I'm on my way.": "我在路上了。",
"Got it. Sorry about that.": "知道了，不好意思。",
"Thanks! I'll take the window seat.": "谢谢！那我坐靠窗的。",
"Okay, let me try again.": "好，我再试一次。",
"Do I? I've been working late all week.": "是吗？我这一周都在加班。",
"Really? What kind of job?": "真的？想换什么工作？",
"Oh, fun! What kind of dog?": "哇，好玩！想养什么狗？",
"Yeah, I'm free. What's up?": "有空，怎么了？",
"Not at all. It's a little chilly.": "不介意，是有点冷。",
"No problem. Take your time.": "没问题，你慢慢来。",
"Me too. Let's order in.": "我也是，叫外卖吧。",
"Me too. It's a nice day for it.": "我也是，今天天气适合走走。",
"Let's check the price first.": "我们先看看价格。",
"Let's leave early, just in case.": "那我们早点出发，以防万一。",
"Lucky you. I'm not a morning person.": "你真好，我可起不来。",
"You'll get used to it.": "你会慢慢习惯的。",
"Oh, cool. Did you like it there?": "哦，不错，你喜欢那儿吗？",
"And now you love them?": "那你现在爱吃了？",
"That's a long commute.": "通勤时间够长的。",
"Change always takes time.": "改变总需要时间。",
"Me too! It's been way too long.": "我也是！太久没见了。",
"Any big plans?": "有什么大计划吗？",
"It's down the hall on the left.": "走廊尽头左手边。",
"Yeah, here you go.": "有，给你。",
"Sorry, my phone died.": "抱歉，我手机没电了。",
"She's probably stuck in traffic.": "她可能堵在路上了。",
"Then we'll just stay inside.": "那我们就待在室内。",
"Good idea. Let's beat the traffic.": "好主意，避开堵车。",
"He's just so funny.": "他太搞笑了。",
"Try not to stress about it.": "别太为这事焦虑。",
"You only live once, right?": "人生就一次嘛，对吧？",
"I'll add it to my list.": "我把它加进片单里。",
"Honestly, that sounds kind of nice.": "说实话，那听着也挺好。",
"Oh no! How'd you find your way back?": "糟糕！那你们怎么找回来的？",
"You really think so?": "你真这么觉得？",
"Thanks. That makes me feel better.": "谢谢，这样我好受多了。",
"It's okay. Next time, right?": "没事，下次注意就好。",
"Sorry, I totally forgot.": "抱歉，我完全忘了。",
"Then we'd better get going.": "那我们得出发了。",
"I'll bring an umbrella.": "那我带把伞。",
"Okay, I'm coming!": "好，我来了！",
"Let's leave in five minutes.": "那五分钟后出发。",
"Same here. It's such a waste of time.": "我也是，太浪费时间了。",
"I don't blame her.": "这不怪她。",
"Okay, let's just stay in.": "好吧，那就待在家里。",
"Yeah, I'll just turn on the fan.": "是啊，我开个风扇吧。",
"I think so. The water's pretty nice.": "应该行，水挺舒服的。",
"You're right. She can handle it.": "你说得对，她能自己处理。",
"Sure, it's a nice night.": "好啊，今晚天气不错。",
"You're right. I'll start today.": "你说得对，我今天就开始。",
"Will do. Wish me luck.": "好的，祝我好运。",
"Thanks, I'll be waiting.": "谢谢，我等你消息。",
"Don't worry, I always do.": "放心，我每次都锁。",
"Got it. Anything else?": "知道了，还有别的吗？",
"Thanks, I will.": "谢谢，我会的。",
"Thanks! Don't mind if I do.": "谢谢！那我不客气了。",
"Maybe we can push the deadline.": "也许我们可以把截止日期往后推。",
"Seriously? Then how was I supposed to know?": "真的吗？那我怎么会知道？",
"Yeah, it's pretty pricey.": "是啊，确实挺贵的。",
"Okay. Get some rest.": "好吧，好好休息。",
"I hate it when that happens.": "最讨厌这种时候了。",
"Yep. I'm glad you thought of it.": "是啊，幸好你想到了。",
"That means a lot. Thank you.": "这对我意义很大，谢谢你。",
"Maybe try a different approach.": "也许换个方法试试。",
"That's so nice of you.": "你太好了。",
"Aw, that's sweet.": "哎呀，真暖心。",
"Agreed. Let's go now.": "同意，我们现在就走。",
"Exactly. Let's get it over with.": "没错，赶紧弄完吧。",
"Me too. I'm always so busy.": "我也想，我总是太忙。",
"You could take a class.": "你可以去上个课。",
"Okay, how much more?": "好，还需要多久？",
"It's okay. I forgive you.": "没关系，我原谅你了。",
"You guys are brave.": "你们真勇敢。",
"Some things never get old.": "有些东西永远不过时。",
"Okay, let me know either way.": "好，不管怎样都告诉我一声。",
"I know. I'll keep at it.": "我知道，我会坚持的。",
"Good idea. It looks cloudy.": "好主意，看着要阴天。",
"Thanks. I'll save it.": "谢谢，我存一下。",
"Ugh, that's so annoying.": "唉，太烦了。",
"That sounds so dramatic.": "听着好戏剧化。",
"Don't worry, I won't tell anyone.": "放心，我不会告诉别人的。",
"Sure, I'll call you after work.": "好，我下班给你回电话。",
"Sorry! Traffic was terrible.": "抱歉！路上堵得厉害。",
"I couldn't agree more.": "我太同意了。",
"You're right. Let's just drop it.": "你说得对，算了吧。",
"Good point. Let's just stay home.": "说得对，我们就待在家吧。",
"Come on, it'll be fun.": "来嘛，会很好玩的。",
"Not if we work late.": "加个班就不一定了。",
"Yeah, it's been a crazy day.": "是啊，今天忙疯了。",
"Let's grab it before it's gone.": "趁还没卖完赶紧拿下。",
"Sure, no rush.": "好，不着急。",
"Quick, turn off your phone.": "快，把手机关了。",
"She sounds like a keeper.": "听起来她可值得珍惜。",
"No wonder there's always a line.": "难怪总排长队。",
"Fine. I'll get my coat.": "好吧，我去拿外套。",
"Let me text him and ask.": "我发消息问问他。",
"Don't worry, I'll teach you.": "别担心，我教你。",
"Yeah, rent here is crazy.": "是啊，这儿房租太离谱了。",
"Okay, let's do Thai food.": "好，那就吃泰国菜。",
"Give me a day to think about it.": "给我一天时间考虑。",
"Aw, did you cry?": "哇，你哭了吗？",
"But we made it through.": "但我们还是挺过来了。",
"Isn't that always the way?": "不总是这样吗？",
"Typical. Did you get wet?": "老样子，你淋湿了吗？",
"That happens to a lot of people.": "很多人都这样。",
"At least he finally told the truth.": "至少他最终说了实话。",
"I know. I'll start next month.": "我知道，我下个月就开始。",
"Okay, let's sit down after dinner.": "好，晚饭后我们坐下来聊聊。",
"Good idea. Movie night?": "好主意，看电影吧？",
"Yeah, he's a fast learner.": "是啊，他学得很快。",
"I'm with you. Let's get to work.": "我赞成，开干吧。",
"Me too. It's quicker.": "我也是，打电话快。",
"Fair enough. Let's skip it.": "也对，那就不去了。",
"Great, I'll see you there.": "好，到时见。",
"Then let's make the best of it.": "那我们就尽力而为吧。",
"Sounds like a good deal to me.": "我觉得这买卖划算。",
"Of course. Always.": "当然，永远如此。",
"Aw, thanks! I'll be there.": "哇，谢谢！我一定到。",
"You're right. Let's make one now.": "你说得对，我们现在就定一个。",
"Agreed. It'll last for years.": "同意，能用好多年呢。",
"Try your best. It'd be great to see you.": "尽量来吧，很想见你。",
"Yeah, he always does that.": "是啊，他总这样。",
"Sure! Pepperoni?": "好啊！要意式辣香肠的？",
"Maybe I will. I need a break.": "也许真该休一天，我需要歇歇。",
"Six works for me.": "六点可以。",
"Fine by me. I'm tired anyway.": "我没意见，反正我也累了。",
"Deal. No work talk tonight.": "一言为定，今晚不聊工作。",
"You're right. It's not that serious.": "你说得对，没那么严重。",
"Yeah, it takes time.": "是啊，需要时间。",
"Just use your phone's map.": "用手机地图就好。",
"Have you tried cutting out caffeine?": "你试过戒咖啡因吗？",
"Same here. I'm terrible with names.": "我也是，我特别记不住名字。",
"Nice! Where do you usually go?": "不错！你一般去哪儿？",
"Me neither. They're too scary.": "我也不喜欢，太吓人了。",
"I love it! It really suits you.": "我很喜欢！特别适合你。",
"That's a big move. Are you sure?": "这可是大决定，你确定吗？",
"Of course. Go ahead.": "当然，坐吧。",
"Sure, the more the merrier.": "当然，人越多越热闹。",
"Thanks. I'm feeling a bit better now.": "谢谢，我现在好一点了。",
"Thank you. It's been a hard week.": "谢谢你，这周真的很难熬。",
"Already? Okay, let me grab my coat.": "这么快？好，我拿下外套。",
"Agreed. I'm ready for something new.": "同意，我准备好迎接新东西了。",
"Okay, thanks for understanding.": "好，谢谢你理解。",
"Thanks. I'll take my time.": "谢谢，那我慢慢来。",
"I know. It's okay.": "我知道，没事的。",
"No problem. Go ahead.": "没关系，你说。",
"I know! This week flew by.": "是啊！这周过得好快。",
"Of course I did!": "我当然记得！",
"Yeah, I need some sleep.": "是啊，我得睡一觉。",
"Should we go talk to her?": "我们要不要去跟她聊聊？",
"No worries. Maybe next time.": "没事，下次吧。",
"Okay, let's drop it.": "好，那就不说了。",
"Good call. It's getting cold.": "说得对，天变冷了。",
"Good idea. I'll check it again.": "好主意，我再查一遍。",
"True. The worst they can say is no.": "确实，大不了被拒绝。",
"Same. Let's grab one.": "我也是，去买一杯吧。",
"Maybe wait for the new model.": "也许等等新款。",
"Let me know when you decide.": "决定了告诉我。",
"Same. Let's eat.": "我也是，吃饭吧。",
"Oh, I totally forgot!": "哎呀，我完全忘了！",
"I know. It's tough.": "我知道，挺难的。",
"Exactly. We'll figure it out.": "没错，我们会想到办法的。",
"You'll do great. Don't worry.": "你会表现很好的，别担心。",
"Then maybe you should go back.": "那也许你该回去看看。",
"Thank you. That means a lot.": "谢谢你，这对我很重要。",
"Yeah, let's find somewhere closer.": "是啊，找个近点的吧。",
"He's a great guy.": "他人特别好。",
"Sounds like a plan.": "就这么定了。",
"Me too. Maybe someday.": "我也想，也许有一天吧。",
"I'd pay off my parents' house.": "我会把我爸妈的房贷还清。",
"It's okay. You're here now.": "没关系，你现在来了就好。",
"Phew, that was close.": "呼，好险。",
"Do you ever regret it?": "你后悔过吗？",
"I understand. Tell her not to worry.": "我理解，让她别担心。",
"Seriously? Did he say sorry?": "真的吗？他道歉了吗？",
"I totally get it.": "我完全理解。",
"You've earned it.": "这是你应得的。",
"That's so nice to hear.": "听到这个真好。",
"Oh, I remember him. He was so nice.": "哦，我记得他，人特别好。",
"Aw, it hasn't changed at all.": "哇，一点都没变。",
"I'd be annoyed too.": "换我也会很烦。",
"That's great! You must be excited.": "太好了！你一定很期待。",
"Ugh, rush hour is the worst.": "唉，高峰期最糟了。",
"I know a great place nearby.": "我知道附近有家很好的。",
"Is it running okay now?": "现在开起来没问题了吧？",
"That's not fair. Did you get overtime?": "这不公平，有加班费吗？",
"I'll think it over and get back to you.": "我考虑一下再回复你。",
"Yeah, it's just around the corner.": "知道，就在拐角那儿。",
"Let me check the website.": "我上网查一下。",
"Then she should be here any minute.": "那她应该马上就到了。",
"Really? Did he say why?": "真的？他说为什么了吗？",
"Sorry! I'm almost there.": "抱歉！我快到了。",
"About two years now.": "大概两年了。",
"Oh no. Is there anything left?": "啊，还有剩的吗？",
"What was it like the first time?": "第一次见是什么感觉？",
"Lucky you! Send me pictures.": "真羡慕你！记得发照片给我。",
"No, go ahead and take it.": "不用，你开走吧。",
"I'm exhausted. I need a nap.": "累死了，我得睡一会儿。",
"Maybe. He's usually on time.": "有可能，他一般都很准时。",
"Told you you could do it.": "我就说你能行吧。",
"Then let's get the cheaper one.": "那就买便宜的吧。",
"Good call. Did you sleep well?": "明智，你睡得好吗？",
"She must've been relieved.": "她肯定松了口气。",
"Let's go grab something to eat.": "那我们去吃点东西吧。",
"Let's watch it together this weekend.": "那这周末一起看吧。",
"Me neither. It's incredible.": "我也没见过，太不可思议了。",
"Then let's make the most of it.": "那就好好利用这一天吧。",
"Me too. Next time, come with me.": "我也是，下次一起来。",
"It's okay. Everyone makes mistakes.": "没事，谁都会犯错。",
"Good idea. He looks exhausted.": "好主意，他看起来累坏了。",
"That was so sweet of her.": "她人太好了。",
"True. You just have to keep at it.": "没错，只要坚持就行。",
"True. I miss my coworkers, though.": "确实，不过我挺想同事们的。"
};

/* 把补充数据接到卡片上：词汇例句有了整句中文，所有例句都有了「对方可能这样回」 */
(function(){
  for(const k in EX_REPLY_ZH) if(!(k in REPLY_ZH)) REPLY_ZH[k] = EX_REPLY_ZH[k];
  Object.values(EXTRA_CARDS).forEach(c => {
    if(c.single) return;
    if(c.scene === "vocab" && EX_ZH[c.en]) c.zh = EX_ZH[c.en];
    const r = EX_REPLY[c.en];
    if(r && !c.reply) c.reply = r[0];
  });
})();

/* 任何一句英文 → 中文（句库、对方回应、词汇例句、句型例句、连读练习句子） */
let ZH_OF = null;
function zhOf(text){
  if(!text) return "";
  if(!ZH_OF){
    ZH_OF = new Map();
    const put = (en, zh) => { if(en && zh && !ZH_OF.has(en.trim())) ZH_OF.set(en.trim(), zh); };
    ALL_ITEMS.forEach(i => put(i.en, i.zh));
    Object.entries(REPLY_ZH).forEach(([en, zh]) => put(en, zh));
    Object.entries(EX_ZH).forEach(([en, zh]) => put(en, zh));
    [...BASIC_STRUCTURES, ...PATTERNS, ...OTHER_STRUCTURES].forEach(p => p.ex.forEach(([en, zh]) => put(en, zh)));
  }
  return ZH_OF.get(String(text).trim()) || "";
}
