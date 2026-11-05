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

SCENES.push(
  { key:"fly", name:"机场航班", en:"At the airport", mark:"F", color:"var(--teal)", items:[
    ["Where do I | check my bag?", "我在哪里托运行李？", "Right over there at counter twelve."],
    ["Is the flight | on time?", "航班准点吗？", "It's delayed about forty minutes."],
    ["Can I bring this | on the plane?", "这个能带上飞机吗？", "Yeah, as long as it fits in the overhead bin."],
    ["I think | you're in my seat.", "我觉得你坐了我的位置。", "Oh, my bad! Let me move."],
    ["Could I get | a blanket?", "能给我一条毯子吗？", "Sure, I'll bring one right over."],
    ["I'm gonna | miss my connection.", "我要赶不上转机了。", "Let me see if I can rebook you."],
    ["Which gate | are we leaving from?", "我们从哪个登机口出发？", "Gate B twenty-two."],
    ["Do I need to | take my laptop out?", "需要把电脑拿出来吗？", "Yes, put it in a separate bin."],
    ["I'm here | on vacation.", "我是来度假的。", "Great. How long are you staying?"],
    ["Mind if I | squeeze by?", "介意我挤过去一下吗？", "Oh, sure, go ahead."]
  ]},
  { key:"ride", name:"打车交通", en:"Getting around", mark:"R", color:"var(--indigo)", items:[
    ["Could you | drop me off | at the corner?", "能在路口放我下车吗？", "Sure thing."],
    ["How long | will it take | to get there?", "到那里要多久？", "About fifteen minutes with traffic."],
    ["Is this the train | to downtown?", "这是去市中心的火车吗？", "No, you want the one across the platform."],
    ["Which stop | should I get off at?", "我该在哪站下？", "Get off at Union Station."],
    ["Can you | turn up the AC?", "能把空调开大点吗？", "No problem."],
    ["I think | we passed it.", "我觉得我们开过了。", "Oh, you're right. Let me turn around."],
    ["Is it | far from here?", "离这儿远吗？", "Not really, it's like two blocks away."],
    ["Do you know where | I can catch | a bus?", "你知道在哪儿坐公交吗？", "There's a stop right around the corner."],
    ["Can you | pull over | right here?", "能在这儿靠边停吗？", "Sure. Have a good one!"],
    ["I'm kinda lost. | Can you help me out?", "我有点迷路了，能帮帮我吗？", "Sure, where are you trying to go?"]
  ]},
  { key:"bar", name:"酒吧夜生活", en:"At a bar", mark:"B", color:"var(--amber)", items:[
    ["What's good | here?", "这里什么好喝？", "Our IPA is pretty popular."],
    ["I'll have | what she's having.", "我要和她一样的。", "Coming right up."],
    ["Can we | start a tab?", "能先开个单，最后一起结吗？", "Sure, I just need a card."],
    ["This round's | on me.", "这轮我请。", "No way, you got the last one!"],
    ["Can I get | a glass of water | too?", "能再要一杯水吗？", "Of course."],
    ["It's so loud | in here!", "这里好吵！", "Wanna step outside for a sec?"],
    ["I'm gonna | call it a night.", "我准备回去了。", "Already? Okay, get home safe!"],
    ["Is anyone | sitting here?", "这儿有人坐吗？", "Nope, it's all yours."],
    ["Let's grab | one more drink.", "再喝一杯吧。", "Alright, just one more."],
    ["What are you | drinking?", "你在喝什么？", "Just a gin and tonic. Want one?"]
  ]},
  { key:"chat", name:"主动搭讪", en:"Striking up a chat", mark:"N", color:"var(--cyan)", items:[
    ["Is this your | first time here?", "你是第一次来这儿吗？", "Yeah, actually. Do you come here a lot?"],
    ["I love your jacket. | Where'd you get it?", "我很喜欢你的夹克，在哪儿买的？", "Thanks! I got it at a thrift store."],
    ["Have we | met before?", "我们之前见过吗？", "I don't think so. I'm Sam, by the way."],
    ["How do you know | the host?", "你怎么认识主人的？", "We went to college together."],
    ["What are you | reading?", "你在看什么书？", "It's a mystery novel. Pretty good so far."],
    ["Sorry, | I couldn't help | overhearing.", "不好意思，我无意中听到了你们说话。", "Oh, no worries! Are you into hiking too?"],
    ["Do you know | this area | pretty well?", "你对这一带熟吗？", "Pretty well. I live a few blocks away."],
    ["Is it always | this crowded?", "这里总是这么多人吗？", "Only on weekends."],
    ["I'm Leo, | by the way.", "对了，我叫 Leo。", "Nice to meet you, Leo. I'm Kate."],
    ["Mind if I | join you guys?", "介意我加入你们吗？", "Not at all, pull up a chair."]
  ]},
  { key:"date", name:"约会调情", en:"Flirting & dating", mark:"L", color:"var(--pink)", items:[
    ["You have | a great smile.", "你笑起来真好看。", "Aw, thank you. That's sweet."],
    ["Can I | buy you a drink?", "我能请你喝一杯吗？", "Sure, I'd like that."],
    ["Do you wanna | grab coffee | sometime?", "改天要不要一起喝杯咖啡？", "I'd love to. Are you free Saturday?"],
    ["Can I | get your number?", "能留个你的电话吗？", "Sure, here, put it in your phone."],
    ["I had | a really good time | tonight.", "我今晚过得很开心。", "Me too. We should do this again."],
    ["Are you | seeing anyone?", "你现在有对象吗？", "No, I'm single, actually."],
    ["You look | amazing tonight.", "你今晚太好看了。", "Thanks, you clean up pretty nice yourself."],
    ["Text me | when you get home.", "到家给我发个消息。", "I will. Good night!"],
    ["No pressure, | but I'd love | to see you again.", "不勉强，但我很想再见到你。", "I'd like that too."],
    ["I'm actually | seeing someone.", "其实我有对象了。", "Oh, no worries. Have a good night!"]
  ]},
  { key:"phone", name:"打电话", en:"On the phone", mark:"O", color:"var(--slate)", items:[
    ["Hi, I'm calling | about my order.", "你好，我打电话是想问一下我的订单。", "Sure, can I get your order number?"],
    ["Can you | hear me okay?", "你能听清我说话吗？", "You're breaking up a little."],
    ["Sorry, | you're breaking up.", "不好意思，你那边信号断断续续的。", "Let me call you right back."],
    ["Could you | say that again?", "你能再说一遍吗？", "Sure, I said it's on Main Street."],
    ["Can I | put you on hold | for a sec?", "能请你稍等一下吗？", "Sure, no problem."],
    ["Could you | spell that for me?", "你能拼一下吗？", "Sure, it's L-E-E."],
    ["Let me | transfer you.", "我帮你转接。", "Thank you."],
    ["Can I | leave a message?", "我能留个言吗？", "Of course. Go ahead."],
    ["I've been on hold | for twenty minutes.", "我已经等了二十分钟了。", "I'm so sorry about the wait."],
    ["Let me | call you back.", "我回头打给你。", "Okay, talk soon."]
  ]},
  { key:"fix", name:"投诉与解决", en:"Sorting out problems", mark:"X", color:"var(--crimson)", items:[
    ["There's a problem | with my room.", "我的房间有点问题。", "I'm sorry to hear that. What's going on?"],
    ["This isn't | what I ordered.", "这不是我点的。", "Oh, I'm so sorry. Let me fix that."],
    ["I got charged | twice.", "我被扣了两次钱。", "Let me look into that for you."],
    ["It stopped working | after a day.", "用了一天就坏了。", "We can replace it for you."],
    ["Can I | talk to a manager?", "我能找经理谈谈吗？", "Sure, one moment, please."],
    ["I've been waiting | for over an hour.", "我已经等了一个多小时了。", "I apologize. It'll be just a few more minutes."],
    ["Could you | keep it down | a little?", "你们能小声一点吗？", "Oh, sorry! Didn't realize it was that loud."],
    ["I'd like | a refund, | please.", "我想退款。", "Sure. Do you have the receipt?"],
    ["That's not | what we agreed on.", "这跟我们说好的不一样。", "Let me double-check that."],
    ["Is there anything | you can do?", "你们能想想办法吗？", "Let me see what I can do."]
  ]},
  { key:"react", name:"反应与观点", en:"Reactions & opinions", mark:"!", color:"var(--olive)", items:[
    ["No way! | Are you serious?", "不会吧！你认真的？", "Dead serious."],
    ["That's | so cool!", "太酷了！", "Right? I was so excited."],
    ["I know, right?", "就是说啊！", "It's crazy."],
    ["I'm not so sure | about that.", "这个我不太确定。", "Why, what do you think?"],
    ["To be honest, | I'm not a big fan.", "说实话，我不太喜欢。", "Fair enough."],
    ["That's exactly | what I was thinking!", "我也正是这么想的！", "Great minds think alike."],
    ["Good for you!", "真替你高兴！", "Thanks, I worked really hard for it."],
    ["Oh, | that's too bad.", "啊，太可惜了。", "Yeah, oh well."],
    ["You've gotta | be kidding me.", "你开玩笑吧。", "I wish I was."],
    ["It's not | that big of a deal.", "也没什么大不了的。", "I guess you're right."]
  ]},
  { key:"party", name:"朋友聚会", en:"Friends & parties", mark:"Y", color:"var(--violet)", items:[
    ["Thanks for | having me!", "谢谢你邀请我！", "Of course! Make yourself at home."],
    ["What should I | bring?", "我该带点什么？", "Just bring yourself!"],
    ["Help yourself | to some food.", "吃的自己随便拿。", "Thanks, it all looks amazing."],
    ["Can I | get you anything?", "要给你拿点什么吗？", "I'm good, thanks."],
    ["How do you two | know each other?", "你们俩是怎么认识的？", "We used to work together."],
    ["We should | hang out | more often.", "我们应该多聚聚。", "Totally. Let's plan something."],
    ["I'm gonna | head out.", "我先撤了。", "Already? Thanks for coming!"],
    ["Let me know | if you need a hand.", "需要帮忙就说一声。", "Thanks, I think I've got it."],
    ["It was great | catching up.", "叙叙旧真开心。", "Same here. Don't be a stranger!"],
    ["Happy birthday! | How does it feel?", "生日快乐！感觉怎么样？", "Pretty much the same, honestly."]
  ]}
);

SCENES.push(
  { key:"gym", name:"健身运动", en:"Gym & sports", mark:"E", color:"var(--mint)", items:[
    ["Are you | using this machine?", "这台器械你在用吗？", "Nope, it's all yours."],
    ["Mind if I | work in | with you?", "介意我跟你轮流用吗？", "Sure, go ahead."],
    ["How many sets | do you have left?", "你还剩几组？", "Just one more."],
    ["I'm so sore | from yesterday.", "昨天练完我浑身酸痛。", "Same. Leg day is brutal."],
    ["Do you wanna | go for a run | this weekend?", "这周末想一起去跑步吗？", "Sure, how about Saturday morning?"],
    ["I'm trying | to get back | in shape.", "我在努力恢复身材。", "Good for you! Consistency is key."],
    ["What time | does the gym | close?", "健身房几点关门？", "We're open until ten tonight."],
    ["Can you | spot me?", "能帮我保护一下吗？", "Sure, I've got you."],
    ["I'm totally | out of breath.", "我喘不上气了。", "Take a break and grab some water."],
    ["Who's | playing | tonight?", "今晚谁跟谁比赛？", "The Lakers and the Celtics."]
  ]},
  { key:"home", name:"租房居家", en:"Home & renting", mark:"U", color:"var(--sand)", items:[
    ["When is | the rent due?", "房租什么时候交？", "On the first of every month."],
    ["Are utilities | included?", "水电费包含在内吗？", "Water's included, but you pay for electricity."],
    ["The sink | is clogged | again.", "水槽又堵了。", "I'll call the plumber tomorrow morning."],
    ["Can I have | some friends over | this weekend?", "这周末我能请几个朋友来家里吗？", "Sure, just keep it down after ten."],
    ["Whose turn is it | to take out | the trash?", "轮到谁倒垃圾了？", "I think it's yours this week."],
    ["Could you | turn the music down | a bit?", "能把音乐调小一点吗？", "Oh, sorry! I didn't realize it was that loud."],
    ["Is it okay | if I use | the kitchen?", "我可以用一下厨房吗？", "Of course, help yourself."],
    ["We're out of | toilet paper.", "卫生纸用完了。", "I'll grab some on my way home."],
    ["The lease | is up | in June.", "租约六月到期。", "Are you planning to renew?"],
    ["When can I | move in?", "我什么时候能搬进来？", "The place will be ready on the fifteenth."]
  ]},
  { key:"bank", name:"银行办事", en:"Bank & errands", mark:"$", color:"var(--plum)", items:[
    ["I'd like to | open an account.", "我想开个账户。", "Sure. Do you have two forms of ID?"],
    ["I need to | send a package | to Japan.", "我要寄个包裹到日本。", "Would you like to send it express?"],
    ["Is there an ATM | around here?", "附近有 ATM 吗？", "There's one inside the grocery store."],
    ["My card | got declined.", "我的卡被拒了。", "Let me try running it again."],
    ["How long | will it take | to arrive?", "多久能到？", "About five to seven business days."],
    ["I'd like to | deposit | this check.", "我想存这张支票。", "Sure, just sign the back for me."],
    ["Do I need | an appointment?", "需要预约吗？", "No, walk-ins are welcome."],
    ["What are | your hours?", "你们的营业时间是？", "We're open nine to five, Monday through Friday."],
    ["Is there | a fee | for that?", "这个要手续费吗？", "No, it's free for account holders."],
    ["I think | I lost | my credit card.", "我的信用卡好像丢了。", "Let's cancel it and order you a new one."]
  ]},
  { key:"grocery", name:"超市外卖", en:"Groceries & delivery", mark:"M", color:"var(--rose)", items:[
    ["Where can I | find | the eggs?", "鸡蛋在哪儿？", "Aisle seven, next to the milk."],
    ["Paper | or plastic?", "要纸袋还是塑料袋？", "Paper, please."],
    ["Do you have | a rewards card?", "你有会员卡吗？", "No, but can I sign up?"],
    ["Is this | on sale | this week?", "这个这周打折吗？", "Yeah, it's buy one, get one free."],
    ["My order | is missing | an item.", "我的订单少了一样东西。", "Sorry about that. We'll send you a refund."],
    ["Can you | leave it | at the door?", "能放在门口吗？", "Sure, I'll text you when it's there."],
    ["Do you | deliver | to this area?", "你们送这一片吗？", "Yes, delivery's free over thirty-five dollars."],
    ["I think I'll | order takeout | tonight.", "我今晚想点外卖。", "Good idea. Get me some noodles too."],
    ["Is this | fresh?", "这个新鲜吗？", "Yeah, it just came in this morning."],
    ["Can I | get a receipt?", "能给我小票吗？", "It's in the bag."]
  ]}
);

/* 各场景补充的高频说法（追加在原有句子之后，原句编号不变） */
const MORE_ITEMS = {
  cafe: [["Could I get | an extra shot | of espresso?", "能多加一份浓缩吗？", "Sure, that's an extra seventy-five cents."], ["Sorry, could you | make it | a little hotter?", "不好意思，能做得再烫一点吗？", "Of course, I'll remake it for you."], ["Do you have | anything | without caffeine?", "有不含咖啡因的吗？", "We have herbal teas and hot chocolate."], ["Can I | pay | with my phone?", "能用手机付吗？", "Yep, just tap it on the reader."]],
  dining: [["Do you have | any vegetarian | options?", "有素食的选择吗？", "Yes, they're marked with a little leaf."], ["How spicy | is this dish?", "这道菜有多辣？", "It's got a little kick, but it's not too hot."], ["I think | we're ready | to order.", "我们可以点菜了。", "Great, what can I get you?"], ["Could we get | a few more | napkins?", "能再给几张餐巾纸吗？", "Sure, here you go."]],
  shop: [["Can I | try this on?", "这个能试穿吗？", "Of course, the fitting rooms are in the back."], ["Do you have | a smaller | size?", "有小一号的吗？", "Let me take a look for you."], ["How much | is this one?", "这个多少钱？", "That one's forty-nine ninety-nine."], ["Can you | hold this for me | until tomorrow?", "能帮我留到明天吗？", "Sure, I can hold it until closing tomorrow."]],
  health: [["I've been | feeling dizzy | lately.", "我最近总是头晕。", "How long has this been going on?"], ["Do I need | a prescription | for this?", "买这个需要处方吗？", "No, it's over the counter."], ["I think | I sprained | my ankle.", "我好像扭到脚踝了。", "Let's get some ice on it."], ["Is it | anything serious?", "严重吗？", "No, you'll be fine in a few days."]],
  work: [["Can I | pick your brain | for a sec?", "能请教你一下吗？", "Sure, what's on your mind?"], ["I'll | keep you | posted.", "有进展我随时告诉你。", "Thanks, I appreciate it."], ["Let's | take this | offline.", "这个我们会后单独聊。", "Good idea. I'll ping you after."], ["I'm | swamped | this week.", "我这周忙疯了。", "Do you need me to take anything off your plate?"]],
  talk: [["How's | everything | going?", "一切都还好吗？", "Can't complain. How about you?"], ["What's new | with you?", "你最近有什么新鲜事？", "Not a whole lot, honestly."], ["Crazy weather | we're having, | huh?", "最近天气真怪，是吧？", "I know! It was hot yesterday and freezing today."], ["Are you doing | anything fun | this weekend?", "这周末有什么好玩的安排吗？", "I might go hiking if the weather's nice."]],
  plans: [["Does Friday | work | for you?", "周五你方便吗？", "Friday's perfect."], ["Let's just | play it | by ear.", "到时候看情况吧。", "Sounds good, just text me."], ["I'm running | about ten minutes | behind.", "我大概会晚十分钟。", "No worries, I'll grab us a table."], ["Can I | take | a rain check?", "这次先算了，改天行吗？", "Of course. Maybe next week?"]],
  travel: [["Can I leave | my bags here | after checkout?", "退房后能把行李寄存在这儿吗？", "Sure, we'll keep them behind the desk."], ["The Wi-Fi | in my room | isn't working.", "我房间的 Wi-Fi 不能用。", "Sorry about that. I'll send someone up."], ["Could I get | a wake-up call | at six?", "能六点叫醒我吗？", "Absolutely, six a.m. it is."], ["Are there | any good places | to eat nearby?", "附近有好吃的地方吗？", "There's a great taco place down the street."]],
  fly: [["Is there | a direct | flight?", "有直飞的航班吗？", "There's one tomorrow morning at nine."], ["How much | is the fee | for an extra bag?", "多一件行李要多少钱？", "It's thirty-five dollars per bag."], ["Where's | the baggage | claim?", "行李提取处在哪儿？", "Just follow the signs downstairs."], ["We're | about to | board.", "我们快登机了。", "Okay, text me when you land."]],
  ride: [["Is this | the right way | to the museum?", "这是去博物馆的路吗？", "Yep, just keep going straight."], ["How much | is a ticket | to the airport?", "到机场的票多少钱？", "It's twelve fifty one way."], ["Could you | take | the highway?", "能走高速吗？", "Sure, it'll be faster this time of day."], ["Does this bus | stop | at Main Street?", "这辆公交在 Main Street 停吗？", "Yeah, it's the third stop."]],
  bar: [["What do you | have | on tap?", "你们有什么生啤？", "We've got a lager, an IPA, and a stout."], ["Can I get the check | when you | get a chance?", "你有空的时候能帮我结账吗？", "Sure, I'll be right back."], ["I'm | a little | buzzed.", "我有点微醺了。", "Maybe switch to water for a bit."], ["Do you guys | have | happy hour?", "你们有欢乐时光优惠吗？", "Yep, half-price drinks until seven."]],
  chat: [["That's a cute dog. | What's | his name?", "你的狗好可爱，叫什么名字？", "Thanks! His name's Biscuit."], ["Are you | from | around here?", "你是本地人吗？", "Not originally, but I've lived here a few years."], ["Have you | been here | before?", "你以前来过这儿吗？", "A couple of times. The food's great."], ["What brings you | here | tonight?", "今晚怎么来这儿了？", "My friend dragged me out, actually."]],
  date: [["I've been wanting | to ask you out | for a while.", "我想约你出去很久了。", "Really? I was hoping you would."], ["Want to | get dinner | sometime this week?", "这周找时间一起吃个晚饭？", "Yeah, I'd really like that."], ["You're | really easy | to talk to.", "跟你聊天很舒服。", "I feel the same way about you."], ["Let me | walk you | home.", "我送你回家吧。", "That's sweet. Sure."]],
  phone: [["Who's | calling, | please?", "请问您是哪位？", "This is Leo from the marketing team."], ["Sorry, I think | I have | the wrong number.", "抱歉，我好像打错了。", "No problem. Have a good day."], ["I'm about to | lose | signal.", "我这边快没信号了。", "Okay, call me when you can."], ["Is now | a good time | to talk?", "现在方便说话吗？", "Actually, can I call you back in ten?"]],
  fix: [["The heater | in my room | isn't working.", "我房间的暖气坏了。", "I'm sorry. I'll have maintenance come up."], ["I was told | it would be ready | today.", "之前说好今天就能好的。", "Let me check on that for you."], ["Could you | look into it | for me?", "能帮我查一下吗？", "Sure, give me a few minutes."], ["This is | the third time | it's happened.", "这已经是第三次了。", "I completely understand your frustration."]],
  react: [["That's | wild!", "太离谱了！", "Right? I couldn't believe it."], ["Makes | sense.", "说得通。", "Yeah, I figured you'd get it."], ["I'm so | happy | for you!", "真为你高兴！", "Thanks, it means a lot."], ["That's | a good | point.", "你说得有道理。", "Thanks. I've been thinking about it a lot."]],
  party: [["Who else | is | coming?", "还有谁会来？", "Just a few people from work."], ["I brought | some | snacks.", "我带了点零食。", "Oh, you didn't have to!"], ["This place | looks | amazing!", "这地方布置得太漂亮了！", "Thanks, we just finished decorating."], ["Cheers | to | that!", "为此干杯！", "Cheers!"]]
};
SCENES.forEach(s => { if(MORE_ITEMS[s.key]) s.items.push(...MORE_ITEMS[s.key]); });

/* 场景分类 */
const CATS = [
  { key:"daily", name:"日常生活", scenes:["cafe","dining","shop","grocery","health","home","gym"] },
  { key:"travel", name:"旅行出行", scenes:["travel","fly","ride"] },
  { key:"social", name:"社交搭讪", scenes:["talk","chat","bar","party","react","plans"] },
  { key:"date", name:"约会调情", scenes:["date"] },
  { key:"comm", name:"工作沟通", scenes:["work","phone","fix","bank"] }
];
SCENES.forEach(s => { s.cat = (CATS.find(c => c.scenes.includes(s.key)) || CATS[0]).key; });

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

TOPICS.push(
  { scene:"fly", title:"航班取消了", them:"Gate agent", opener:"Hi there, how can I help you?", opener_zh:"你好，有什么可以帮你？", brief:"你的航班被取消了。去柜台问能不能改签到今天晚些时候的航班，再问问有没有餐券或者酒店安排。", hints:["My flight got canceled", "Is there any way…", "Do you guys offer…"] },
  { scene:"fly", title:"过海关", them:"Officer", opener:"What's the purpose of your visit?", opener_zh:"你这次来是做什么的？", brief:"入境美国时，海关官员问你来做什么、待多久、住在哪里。自然地回答。", hints:["I'm here on vacation", "for about a week", "I'm staying at…"] },
  { scene:"ride", title:"上了 Uber", them:"Driver", opener:"Hey there! Where are we headed?", opener_zh:"你好！我们去哪儿？", brief:"你上了一辆 Uber。告诉司机目的地，顺便问问路上大概要多久，能不能把空调调小一点。", hints:["Could you take me to…", "How long do you think…", "Would you mind…"] },
  { scene:"travel", title:"请路人帮忙拍照", them:"Stranger", brief:"你在景点想请路人帮你拍张照，告诉他怎么拍（要把后面的建筑拍进去），拍完再请他多拍一张。", hints:["Would you mind taking…", "Could you get … in the background?", "One more, just in case"] },
  { scene:"travel", title:"问前台吃什么", them:"Concierge", opener:"Good evening! What can I do for you?", opener_zh:"晚上好！有什么能帮你的？", brief:"问酒店前台附近有没有好吃又不贵的本地餐厅，最好走路就能到。", hints:["Any recommendations for…", "something local", "within walking distance"] },
  { scene:"chat", title:"咖啡店搭讪", them:"Stranger", brief:"咖啡店里，旁边的人正在看一本你也很喜欢的书。自然地开口，聊起来。", hints:["Is that…? I loved that book", "How are you liking it?", "No spoilers, but…"] },
  { scene:"chat", title:"健身房打招呼", them:"Gym regular", brief:"在健身房经常碰到同一个人。今天主动打个招呼，问问他平时怎么练，顺便请教一个动作。", hints:["I see you here all the time", "What's your routine like?", "Mind showing me…"] },
  { scene:"party", title:"派对上找话题", them:"Guest", brief:"朋友的家庭派对上你谁都不认识。找个人开口，问问他怎么认识主人的，再找点共同话题。", hints:["How do you know…", "So what do you do?", "No way, me too!"] },
  { scene:"bar", title:"酒吧点酒请客", them:"Bartender", opener:"Hey, what can I get you?", opener_zh:"嘿，你要点什么？", brief:"在酒吧给你和朋友点两杯酒，问问有什么推荐，说这一轮你请，再开个单。", hints:["What do you recommend?", "I'll take…", "Can I start a tab?"] },
  { scene:"date", title:"约对方喝咖啡", them:"Crush", brief:"你和一个聊得来的人认识不久，想约对方这周末喝咖啡。说得轻松自然，不给对方压力。", hints:["I've really enjoyed talking to you", "Would you wanna…", "No pressure"] },
  { scene:"date", title:"约会时夸对方", them:"Date", opener:"Sorry I'm a little late! Traffic was crazy.", opener_zh:"抱歉我来晚了一点！路上堵得要命。", brief:"约会刚见面，对方迟到了一会儿。先让对方别在意，再真诚地夸一夸对方，然后问问对方平时喜欢做什么。", hints:["No worries at all", "You look great", "So what do you like to do for fun?"] },
  { scene:"date", title:"要联系方式", them:"New friend", brief:"派对上和一个人聊得很开心，快散场了，你想要对方的联系方式（Instagram 或者电话）。", hints:["This was really fun", "Can I get your…", "Let's hang out sometime"] },
  { scene:"date", title:"约会后发消息", them:"Date", brief:"第一次约会结束后，给对方发条消息：说你今晚很开心，想再约一次。", hints:["I had a great time tonight", "We should do it again", "Let me know when you're free"] },
  { scene:"date", title:"被拒也大方", them:"Stranger", opener:"That's really sweet, but I'm actually seeing someone.", opener_zh:"你真好，不过我其实有对象了。", brief:"你约对方出去，对方说已经有对象了。大方得体地回应，轻松地结束对话。", hints:["No worries at all", "They're lucky", "Have a great night"] },
  { scene:"phone", title:"电话订位", them:"Host", opener:"Thanks for calling Luigi's, how can I help you?", opener_zh:"感谢致电 Luigi's，有什么可以帮你？", brief:"打电话给餐厅，订周六晚上七点四个人的位子，问问能不能要靠窗的座位。", hints:["I'd like to make a reservation", "for four people", "Is there any chance…"] },
  { scene:"phone", title:"包裹没收到", them:"Customer service", opener:"Thank you for calling. How can I help you today?", opener_zh:"感谢来电，今天有什么可以帮你？", brief:"网购的东西一直没收到，物流却显示已签收。打给客服说明情况，要求补发或者退款。", hints:["My package never showed up", "It says it was delivered", "Could you either… or…"] },
  { scene:"fix", title:"邻居太吵", them:"Neighbor", opener:"Oh, hey! What's up?", opener_zh:"哦，嘿！怎么了？", brief:"楼上邻居半夜还在开派对。你上去敲门，礼貌但坚定地请他们小声一点。", hints:["Sorry to bother you", "It's kinda late", "Would you mind keeping it down?"] },
  { scene:"work", title:"会上提不同意见", them:"Coworker", opener:"So I think we should launch next month. Thoughts?", opener_zh:"我觉得我们下个月就上线。大家怎么看？", brief:"会上同事提了一个方案，你觉得有风险。礼貌地表达不同意见，再提出你的建议。", hints:["I see where you're coming from", "My only concern is…", "What if we…"] },
  { scene:"work", title:"跟新同事介绍自己", them:"New colleague", opener:"Hi! I'm new here. What do you do?", opener_zh:"你好！我是新来的。你是做什么的？", brief:"新同事问你负责什么。简单介绍你的职位、主要做什么，以及之后可能会怎么合作。", hints:["I'm in charge of…", "I mostly work on…", "We'll probably be working together on…"] },
  { scene:"react", title:"听到大新闻", them:"Friend", opener:"Okay, you're not gonna believe this. Jake quit his job to travel the world!", opener_zh:"跟你说，你肯定不信。Jake 辞职去环游世界了！", brief:"朋友告诉你一个惊人的消息。给出自然的反应，再追问细节。", hints:["No way!", "Are you serious?", "Where's he going first?"] },
  { scene:"shop", title:"请店员推荐礼物", them:"Clerk", opener:"Hi there! Looking for anything in particular?", opener_zh:"你好！在找什么特别的东西吗？", brief:"你想给朋友买生日礼物，预算 50 美元左右。请店员推荐，再问能不能帮忙包装。", hints:["I'm looking for a gift", "around fifty bucks", "Could you gift-wrap it?"] }
);
TOPICS.push(
  { scene:"gym", title:"健身房借器械", them:"Gym member", brief:"你想用的器械有人在用。礼貌地问对方还要多久，能不能轮流用。", hints:["How many sets do you have left?", "Mind if I work in?", "No rush"] },
  { scene:"home", title:"跟室友商量家务", them:"Roommate", brief:"你觉得最近家务都是你在做。心平气和地跟室友商量一下怎么分工。", hints:["Can we talk about…", "I feel like…", "How about we take turns?"] },
  { scene:"home", title:"看房提问", them:"Landlord", opener:"So this is the living room. What do you think?", opener_zh:"这是客厅，你觉得怎么样？", brief:"你在看一套出租公寓。问房东租金包含什么、押金多少、什么时候能搬进来。", hints:["Are utilities included?", "How much is the deposit?", "When can I move in?"] },
  { scene:"bank", title:"信用卡被盗刷", them:"Bank rep", opener:"Thanks for calling. How can I help you today?", opener_zh:"感谢来电，今天有什么可以帮你？", brief:"你发现信用卡上有几笔不是你刷的消费。打给银行说明情况，要求冻结卡片并补办新卡。", hints:["I noticed some charges I didn't make", "freeze my card", "send me a new one"] },
  { scene:"grocery", title:"外卖送错了", them:"Support", opener:"Hi! What seems to be the problem with your order?", opener_zh:"你好！你的订单有什么问题？", brief:"你点的外卖送错了：少了一杯饮料，主食也不是你点的。联系客服，要求退款或者重新配送。", hints:["I got the wrong order", "It's missing…", "Could I get a refund?"] },
  { scene:"talk", title:"电梯里聊天气", them:"Neighbor", opener:"Can you believe this weather?", opener_zh:"这天气你敢信吗？", brief:"邻居在电梯里跟你聊天气。自然地接话，再顺便聊两句周末计划。", hints:["I know, right?", "It's been crazy", "Any plans for the weekend?"] }
);
TOPICS.forEach(t => { t.cat = SCENE_CAT_OF(t.scene); });
function SCENE_CAT_OF(k){ const c = CATS.find(c => c.scenes.includes(k)); return c ? c.key : "daily"; }

/* 听准小词：容易在连读里听漏、听混的小词 */
const CONFUSE = [
  ["can","can't","could"], ["do","did"], ["don't","didn't"], ["is","was"], ["isn't","wasn't"], ["are","were"],
  ["will","would"], ["won't","wouldn't"], ["should","shouldn't"], ["i'll","i'd"], ["we'll","we'd"], ["i've","i'd"],
  ["this","that"], ["here","there"], ["at","in","on"], ["a","the"], ["he","she"], ["him","her","them"],
  ["some","any"], ["what","where","when"], ["fifteen","fifty"], ["thirteen","thirty"], ["forty","fourteen"],
  ["twelve","twenty"], ["two","ten"], ["six","seven"]
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
