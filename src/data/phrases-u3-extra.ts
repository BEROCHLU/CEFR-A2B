import type { CategoryGroup } from '../types';

// CEFR A2-B 英作文 追加フレーズデータ (全67問)
export const phrases: CategoryGroup[] = [
  {
    "category": "関係副詞 (when)",
    "items": [
      {
        "id": 1,
        "text": "6月は雨がたくさん降る月です。",
        "answer": "June is the month when it rains a lot."
      },
      {
        "id": 2,
        "text": "僕は彼に初めて会った日を覚えている。",
        "answer": "I remember the day when I first met him."
      },
      {
        "id": 3,
        "text": "彼のお父さんが釣りを楽しむ日は日曜日です。",
        "answer": "Sunday is the day when his father enjoys fishing."
      },
      {
        "id": 4,
        "text": "飛行機が到着する時間を知っていますか?",
        "answer": "Do you know the time when the plane arrives?"
      }
    ]
  },
  {
    "category": "関係副詞 (where)",
    "items": [
      {
        "id": 5,
        "text": "あれは彼が生まれた村です。",
        "answer": "That is the village where he was born."
      },
      {
        "id": 6,
        "text": "僕らが先週行った動物園はとても大きかった。",
        "answer": "The zoo where we went last week was very big."
      },
      {
        "id": 7,
        "text": "あれは彼が数学を教えている学校ですか?",
        "answer": "Is that the school where he teaches math?"
      }
    ]
  },
  {
    "category": "使役動詞 (make / have / let)",
    "items": [
      {
        "id": 8,
        "text": "君におもしろい写真を見せてあげよう。",
        "answer": "Let me show you an interesting picture."
      },
      {
        "id": 9,
        "text": "彼女はウェイターに水を一杯持ってきてもらった (持ってこさせた)。",
        "answer": "She had the waiter bring a glass of water."
      },
      {
        "id": 10,
        "text": "彼は奥さんにコーヒーを入れてもらった (入れさせた)。",
        "answer": "He had his wife make coffee."
      }
    ]
  },
  {
    "category": "知覚動詞 (see / hear / watch / feel / notice)",
    "items": [
      {
        "id": 11,
        "text": "私たちは彼女が見事にピアノを弾くのを聴いた。",
        "answer": "We heard her play the piano wonderfully."
      },
      {
        "id": 12,
        "text": "鳥たちが歌うのを聴いてごらん。",
        "answer": "Listen to the birds sing."
      }
    ]
  },
  {
    "category": "so ... that 構文",
    "items": [
      {
        "id": 13,
        "text": "その俳優はとてもハンサムなので女性に非常に人気がある。",
        "answer": "The actor is so handsome that he is very popular with women."
      },
      {
        "id": 14,
        "text": "その言語はすごく難しかったので私は習得を諦めた。",
        "answer": "The language was so difficult that I gave up learning it."
      },
      {
        "id": 15,
        "text": "彼女はとても忙しくて弟の宿題を手伝えなかった。",
        "answer": "She was so busy that she couldn't help her brother with his homework."
      }
    ]
  },
  {
    "category": "... enough to 構文",
    "items": [
      {
        "id": 16,
        "text": "この家は10 人の人が暮らせる大きさだ。",
        "answer": "This house is big enough for ten people to live in."
      },
      {
        "id": 17,
        "text": "この本は (十分に) やさしいので子供でも読める。",
        "answer": "This book is easy enough for children to read."
      }
    ]
  },
  {
    "category": "too ... to 構文",
    "items": [
      {
        "id": 18,
        "text": "私は忙しすぎてあなたを手伝うことはできません。",
        "answer": "I am too busy to help you."
      },
      {
        "id": 19,
        "text": "その学生は疲れすぎて勉強を続けることができなかった。",
        "answer": "The student was too tired to continue studying."
      },
      {
        "id": 20,
        "text": "彼はその仕事をするには年をとりすぎている。",
        "answer": "He is too old to do the work."
      },
      {
        "id": 21,
        "text": "その本は難しすぎて彼らは読めないでしょう。",
        "answer": "The book will be too difficult for them to read."
      },
      {
        "id": 22,
        "text": "この料理は辛すぎて私は食べられません。",
        "answer": "This dish is too spicy for me to eat."
      }
    ]
  },
  {
    "category": "関係代名詞 what",
    "items": [
      {
        "id": 23,
        "text": "彼らがしたことは正しかった。",
        "answer": "What they did was right."
      }
    ]
  },
  {
    "category": "関係代名詞 目的格 (which/that - 物)",
    "items": [
      {
        "id": 24,
        "text": "あれは彼が描いた絵です。",
        "answer": "That is the picture which he drew."
      },
      {
        "id": 25,
        "text": "これらは私がとった写真ではありません。",
        "answer": "These are not the pictures which I took."
      },
      {
        "id": 26,
        "text": "昨日彼女が焼いたクッキー (複数) は美味しかった。",
        "answer": "The cookies which she baked yesterday were delicious."
      }
    ]
  },
  {
    "category": "関係代名詞 目的格 (who/that - 人)",
    "items": [
      {
        "id": 27,
        "text": "彼はナンシーが愛した男性ではありませんでした。",
        "answer": "He was not the man who Nancy loved."
      },
      {
        "id": 28,
        "text": "あなたが教える生徒たちは頭が良いですか?",
        "answer": "Are the students who you teach smart?"
      },
      {
        "id": 29,
        "text": "あれが、彼が会いたがっている女の子ですか?",
        "answer": "Is that the girl who he wants to see?"
      },
      {
        "id": 30,
        "text": "彼女は誰もが知っている歌手です。",
        "answer": "She is a singer who everyone knows."
      }
    ]
  },
  {
    "category": "関係代名詞 所有格 whose",
    "items": [
      {
        "id": 31,
        "text": "私は窓の大きな部屋で勉強したいの。",
        "answer": "I want to study in a room whose windows are big."
      },
      {
        "id": 32,
        "text": "あの庭の大きな家は僕のおばさんのです。",
        "answer": "That house whose garden is big is my aunt's."
      },
      {
        "id": 33,
        "text": "彼はしっぽの短い猫を飼っている。",
        "answer": "He has a cat whose tail is short."
      }
    ]
  },
  {
    "category": "関係代名詞 主格 (which/that - 物)",
    "items": [
      {
        "id": 34,
        "text": "あれは僕の父に作られた机です。",
        "answer": "That is a desk which was made by my father."
      },
      {
        "id": 35,
        "text": "その作家に書かれた (その) 物語は多くの人に読まれるでしょう。",
        "answer": "The story which was written by the writer will be read by many people."
      }
    ]
  },
  {
    "category": "関係代名詞 主格 (who/that - 人)",
    "items": [
      {
        "id": 36,
        "text": "公園で走っている人たちが見えますか？",
        "answer": "Can you see the people who are running in the park?"
      },
      {
        "id": 37,
        "text": "ピアノを弾いている女性はあなたのおばさんですか?",
        "answer": "Is the woman who is playing the piano your aunt?"
      }
    ]
  },
  {
    "category": "過去分詞の後置修飾",
    "items": [
      {
        "id": 38,
        "text": "あの割れた窓を見なさい。",
        "answer": "Look at that broken window."
      },
      {
        "id": 39,
        "text": "彼は中古車を買うつもりです。",
        "answer": "He is going to buy a used car."
      },
      {
        "id": 40,
        "text": "僕にゆで卵をいくつかください。",
        "answer": "Please give me some boiled eggs."
      }
    ]
  },
  {
    "category": "現在分詞 (進行形・後置修飾)",
    "items": [
      {
        "id": 41,
        "text": "眠っている (その) 赤ちゃんはかわいい。",
        "answer": "The sleeping baby is cute."
      },
      {
        "id": 42,
        "text": "あなたはその走っている少年たちが見えますか?",
        "answer": "Can you see the running boys?"
      },
      {
        "id": 43,
        "text": "校庭を走っている少年たちは彼の生徒たちでした。",
        "answer": "The boys running in the schoolyard were his students."
      },
      {
        "id": 44,
        "text": "私は海を泳いでいるペンギンを一度も見たことがありません。",
        "answer": "I have never seen a penguin swimming in the sea."
      }
    ]
  },
  {
    "category": "重要文型 (SVO / SVOC)",
    "items": [
      {
        "id": 45,
        "text": "私たちはその猫をミケと呼びます。",
        "answer": "We call the cat Mike."
      },
      {
        "id": 46,
        "text": "彼女はあなたを何と呼びますか?",
        "answer": "What does she call you?"
      },
      {
        "id": 47,
        "text": "その知らせを聞いて僕たちはうれしかった (その知らせは僕たちを幸せにした)。",
        "answer": "The news made us happy."
      }
    ]
  },
  {
    "category": "want / tell / ask / help + O + (to) do",
    "items": [
      {
        "id": 48,
        "text": "僕は君にそこに行って欲しい。",
        "answer": "I want you to go there."
      },
      {
        "id": 49,
        "text": "先生は生徒たちに宿題をやるように言った。",
        "answer": "The teacher told the students to do their homework."
      },
      {
        "id": 50,
        "text": "私は彼らにその写真を見ないようにと頼んだ。",
        "answer": "I asked them not to look at the picture."
      }
    ]
  },
  {
    "category": "It is ... (for O) to do",
    "items": [
      {
        "id": 51,
        "text": "英語を学ぶことは大切です。",
        "answer": "It is important to learn English."
      },
      {
        "id": 52,
        "text": "車を運転するのは簡単ですか?",
        "answer": "Is it easy to drive a car?"
      },
      {
        "id": 53,
        "text": "新しいことを学ぶことはおもしろいです。",
        "answer": "It is interesting to learn new things."
      },
      {
        "id": 54,
        "text": "あなたには切手を集めるのがおもしろいのですね？",
        "answer": "It is interesting for you to collect stamps, isn't it?"
      },
      {
        "id": 55,
        "text": "彼には朝早く起きるのが難しいのです。",
        "answer": "It is difficult for him to get up early in the morning."
      }
    ]
  },
  {
    "category": "疑問詞 + to do",
    "items": [
      {
        "id": 56,
        "text": "彼はその機械の使い方を学んでいる。",
        "answer": "He is learning how to use the machine."
      },
      {
        "id": 57,
        "text": "あなたのお母さんはあなたに料理の仕方を教えてくれますか?",
        "answer": "Does your mother teach you how to cook?"
      },
      {
        "id": 58,
        "text": "どちらの本もおもしろそうなので、僕はどちらを買うべきかわからない。",
        "answer": "Since both books look interesting, I don't know which book to buy."
      }
    ]
  },
  {
    "category": "間接疑問文",
    "items": [
      {
        "id": 59,
        "text": "彼らはどんな食べ物が好きなのかしら?(wonder使用)",
        "answer": "I wonder what kind of food they like."
      },
      {
        "id": 60,
        "text": "彼らはその言葉が何を意味するのか知ろうとした。",
        "answer": "They tried to find out what the word meant."
      }
    ]
  },
  {
    "category": "接続詞 (while / until / though)",
    "items": [
      {
        "id": 61,
        "text": "彼はその国にいる間に多くのことを学んだ。",
        "answer": "While he was in the country, he learned many things."
      },
      {
        "id": 62,
        "text": "僕は両親が帰ってくるまで家にいなければならないんです。",
        "answer": "I have to stay home until my parents come back."
      },
      {
        "id": 63,
        "text": "とても遅かったけれど、彼女は出かけることにした (決めた)。",
        "answer": "Though it was very late, she decided to go out."
      }
    ]
  },
  {
    "category": "接続詞 (if / because / before / after)",
    "items": [
      {
        "id": 64,
        "text": "もし彼が明日来なかったら、僕がその仕事をするよ。",
        "answer": "If he doesn't come tomorrow, I will do the work."
      },
      {
        "id": 65,
        "text": "雨が降っていたので、彼は一日中家にいた。",
        "answer": "Because it was raining, he stayed home all day."
      },
      {
        "id": 66,
        "text": "あなたの弟は寝る前にいつも歯を磨きますか?",
        "answer": "Does your brother always brush his teeth before he goes to bed?"
      },
      {
        "id": 67,
        "text": "彼が車を洗った後に雨が降り始めた。",
        "answer": "After he washed the car, it began to rain."
      }
    ]
  }
];

export const questionsData = phrases;
export const questionsExtraData = phrases;
export default phrases;
