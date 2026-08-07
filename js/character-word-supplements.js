/**
 * 국립국어원 일반 표제어만으로는 문맥 독음에 맞는 용례를 찾기 어려운 글자의 보충 어휘.
 *
 * - 두음법칙·다음자 때문에 현재 천자문 독음과 사전 표제어 독음이 다른 경우에는
 *   같은 독음이 살아 있는 합성어를 우선했다.
 * - 이체자는 천자문에 실린 자형을 그대로 보여 주고, 현재 널리 쓰는 자형을 뜻풀이에 밝혔다.
 * - 현대 일반어가 없는 글자는 천자문 원문이나 고전 문헌에서 독립적으로 풀이되는 표현을 썼다.
 */
export const CHARACTER_WORD_SUPPLEMENTS = Object.freeze({
  "宿": [
    { word: "성수", origin: "星宿", definition: "별자리. 또는 별자리를 이루는 별들." },
  ],
  "來": [
    { word: "왕래", origin: "往來", definition: "사람이나 물건이 서로 오고 감." },
  ],
  "崑": [
    { word: "곤륜", origin: "崑崙", definition: "옥이 난다고 전해지는 전설 속의 높은 산." },
  ],
  "柰": [
    { word: "내자", origin: "柰子", definition: "옛 문헌에서 사과나 능금 계열의 열매를 이르는 말." },
  ],
  "國": [
    { word: "국가", origin: "國家", definition: "영토와 국민, 주권을 갖춘 사회 조직." },
  ],
  "率": [
    { word: "솔선", origin: "率先", definition: "남보다 앞장서서 먼저 행함." },
  ],
  "賴": [
    { word: "뇌급", origin: "賴及", definition: "은덕이나 이로움이 널리 미침." },
  ],
  "豈": [
    { word: "기감", origin: "豈敢", definition: "‘어찌 감히’라는 뜻으로, 매우 조심스럽게 낮추어 이르는 말." },
  ],
  "烈": [
    { word: "열렬", origin: "熱烈", definition: "태도나 감정이 매우 강하고 뜨거움." },
  ],
  "良": [
    { word: "개량", origin: "改良", definition: "나쁜 점을 보완하여 더 좋게 만듦." },
  ],
  "立": [
    { word: "설립", origin: "設立", definition: "기관이나 조직 따위를 새로 만들어 세움." },
  ],
  "則": [
    { word: "즉진", origin: "則盡", definition: "그러면 온 힘을 다한다는 천자문의 표현." },
  ],
  "履": [
    { word: "천리", origin: "踐履", definition: "몸소 밟아 행함. 곧 실제로 실천함." },
  ],
  "蘭": [
    { word: "목란", origin: "木蘭", definition: "목련을 달리 이르는 말." },
  ],
  "流": [
    { word: "합류", origin: "合流", definition: "둘 이상의 흐름이 한데 합하여 흐름." },
  ],
  "離": [
    { word: "분리", origin: "分離", definition: "서로 나뉘어 떨어짐. 또는 그렇게 되게 함." },
  ],
  "顛": [
    { word: "전도", origin: "顛倒", definition: "위아래나 앞뒤가 뒤바뀜." },
  ],
  "洛": [
    { word: "경락", origin: "京洛", definition: "서울이나 한 나라의 수도를 이르는 말." },
  ],
  "啟": [
    { word: "계몽", origin: "啟蒙", definition: "지식이 부족한 사람을 깨우쳐 바른 지식을 갖게 함." },
  ],
  "既": [
    { word: "기존", origin: "既存", definition: "이미 존재함." },
  ],
  "稾": [
    { word: "초고", origin: "草稾", definition: "글을 완성하기 전에 처음 써 본 원고. 稾는 稿와 같은 글자이다." },
  ],
  "隸": [
    { word: "예서", origin: "隸書", definition: "한자 서체의 하나. 隸는 이 말의 첫머리에서 ‘예’로 읽는다." },
  ],
  "羅": [
    { word: "망라", origin: "網羅", definition: "일정한 범위 안의 것을 빠짐없이 모두 포함함." },
  ],
  "車": [
    { word: "거마비", origin: "車馬費", definition: "수레나 말을 타는 데 드는 비용이라는 뜻으로, 교통비를 이르는 말." },
  ],
  "磻": [
    { word: "반계", origin: "磻溪", definition: "태공망이 때를 기다리며 낚시하던 시내를 이르는 말." },
  ],
  "迴": [
    { word: "윤회", origin: "輪迴", definition: "생명이 죽은 뒤에도 다른 모습으로 태어나 삶과 죽음을 되풀이함." },
  ],
  "說": [
    { word: "부열", origin: "傅說", definition: "상나라 무정 임금을 도운 재상." },
  ],
  "寔": [
    { word: "식녕", origin: "寔寧", definition: "참으로 편안하다는 천자문의 표현." },
  ],
  "譽": [
    { word: "명예", origin: "名譽", definition: "훌륭하다고 평가받아 얻는 좋은 평판이나 이름." },
  ],
  "青": [
    { word: "청년", origin: "青年", definition: "젊은 나이의 사람. 青은 靑과 같은 글자이다." },
  ],
  "幷": [
    { word: "병합", origin: "幷合", definition: "둘 이상의 조직이나 지역을 하나로 합침." },
  ],
  "恆": [
    { word: "항구", origin: "恆久", definition: "변하지 않고 오래 계속됨. 恆은 恒과 같은 글자이다." },
  ],
  "塞": [
    { word: "요새", origin: "要塞", definition: "군사적으로 중요한 곳에 튼튼하게 만든 방어 시설." },
  ],
  "緜": [
    { word: "면면", origin: "緜緜", definition: "끊이지 않고 오래 이어지는 모양. 緜은 綿과 같은 글자이다." },
  ],
  "岫": [
    { word: "수운", origin: "岫雲", definition: "산의 바위굴이나 봉우리에서 피어오르는 구름." },
  ],
  "杳": [
    { word: "묘연", origin: "杳然", definition: "그윽하고 멀어서 눈에 아물아물하거나 소식이 없어 알 수 없음." },
  ],
  "茲": [
    { word: "금자", origin: "今茲", definition: "지금 이때. 또는 올해." },
  ],
  "俶": [
    { word: "숙장", origin: "俶裝", definition: "길을 떠날 채비를 차림." },
  ],
  "敕": [
    { word: "칙령", origin: "敕令", definition: "임금이 내리던 명령." },
  ],
  "聆": [
    { word: "영청", origin: "聆聽", definition: "귀를 기울여 주의 깊게 들음." },
  ],
  "理": [
    { word: "합리", origin: "合理", definition: "이치나 논리에 맞음." },
  ],
  "猷": [
    { word: "가유", origin: "嘉猷", definition: "훌륭하고 아름다운 계책." },
  ],
  "皋": [
    { word: "임고", origin: "林皋", definition: "숲과 언덕을 아울러 이르는 말." },
  ],
  "即": [
    { word: "즉시", origin: "即時", definition: "어떤 일이 이루어지는 바로 그때. 即은 卽과 같은 글자이다." },
  ],
  "閒": [
    { word: "한가", origin: "閒暇", definition: "겨를이 생겨 여유가 있음. 閒은 閑과 같은 글자로 쓰인다." },
  ],
  "累": [
    { word: "연루", origin: "連累", definition: "다른 일이나 사람과 관련되어 함께 얽힘." },
  ],
  "慼": [
    { word: "우척", origin: "憂慼", definition: "근심하고 슬퍼함." },
  ],
  "晚": [
    { word: "만학", origin: "晚學", definition: "나이가 든 뒤에 공부를 시작함. 晚은 晩과 같은 글자이다." },
  ],
  "颻": [
    { word: "표요", origin: "飄颻", definition: "바람에 이리저리 나부끼는 모양." },
  ],
  "鵾": [
    { word: "곤붕", origin: "鵾鵬", definition: "아주 큰 상상의 새. 큰 뜻이나 뛰어난 인물을 비유하기도 한다." },
  ],
  "翫": [
    { word: "완상", origin: "翫賞", definition: "즐기며 감상함." },
  ],
  "輶": [
    { word: "유거", origin: "輶車", definition: "사신이 타거나 사냥할 때 쓰던 가벼운 수레." },
  ],
  "墻": [
    { word: "곡장", origin: "曲墻", definition: "능이나 묘의 뒤쪽을 둘러쌓은 나지막한 담." },
  ],
  "飡": [
    { word: "손반", origin: "飡飯", definition: "밥을 먹는다는 천자문의 표현." },
  ],
  "煒": [
    { word: "위황", origin: "煒煌", definition: "불빛이 환하고 밝게 빛나는 모양." },
  ],
  "笋": [
    { word: "죽순", origin: "竹笋", definition: "대나무의 땅속줄기에서 돋아나는 어린싹. 笋은 筍과 같은 글자이다." },
  ],
  "盃": [
    { word: "건배", origin: "乾盃", definition: "잔을 들어 서로 축하하거나 건강을 비는 일. 盃는 杯와 같은 글자이다." },
  ],
  "舉": [
    { word: "거행", origin: "舉行", definition: "행사나 의식 따위를 치러 행함. 舉는 擧와 같은 글자이다." },
  ],
  "驢": [
    { word: "여마", origin: "驢馬", definition: "당나귀. 또는 당나귀와 말을 아울러 이르는 말." },
  ],
  "騾": [
    { word: "나려", origin: "騾驢", definition: "노새와 나귀를 아울러 이르는 말. 騾는 이 말의 첫머리에서 ‘나’로 읽는다." },
  ],
  "嵇": [
    { word: "혜강", origin: "嵇康", definition: "거문고로 이름난 중국 위진 시대의 사상가이자 문인." },
  ],
  "顰": [
    { word: "효빈", origin: "效顰", definition: "남의 행동을 덮어놓고 흉내 내는 일을 비유하는 말." },
  ],
  "妍": [
    { word: "연소", origin: "妍笑", definition: "곱고 아름답게 웃음." },
  ],
  "祜": [
    { word: "수우", origin: "修祜", definition: "몸을 닦아 복을 얻는다는 천자문의 표현." },
  ],
  "劭": [
    { word: "길소", origin: "吉劭", definition: "길하고 아름답다는 천자문의 표현." },
  ],
  "領": [
    { word: "대통령", origin: "大統領", definition: "공화국에서 국가를 대표하는 최고 책임자." },
  ],
  "廊": [
    { word: "낭묘", origin: "廊廟", definition: "임금과 신하가 정사를 의논하던 조정." },
  ],
  "陋": [
    { word: "고루", origin: "固陋", definition: "낡은 생각에 얽매여 보고 듣는 것이 좁음." },
  ],
  "誚": [
    { word: "초책", origin: "誚責", definition: "잘못을 나무라고 꾸짖음." },
  ],

  // 사전 후보가 인명·지명 위주인 글자는 더 직접적이고 학습하기 쉬운 용례를 우선한다.
  "岡": [
    { word: "곤강", origin: "崑岡", definition: "곤륜산의 산등성이." },
  ],
  "李": [
    { word: "이화", origin: "李花", definition: "오얏나무의 꽃." },
  ],
  "拱": [
    { word: "수공", origin: "垂拱", definition: "옷소매를 드리우고 팔짱을 낀다는 뜻으로, 애쓰지 않고 천하를 다스림." },
  ],
  "壹": [
    { word: "일체", origin: "壹體", definition: "서로 떨어지지 않은 한 몸이나 하나의 전체. 壹은 一의 갖은자이다." },
  ],
  "畵": [
    { word: "회화", origin: "繪畵", definition: "선이나 색채로 평면에 형상을 그려 내는 조형 예술." },
  ],
  "尹": [
    { word: "부윤", origin: "府尹", definition: "조선 시대에 한성부와 일부 큰 고을을 맡아 다스리던 벼슬." },
  ],
  "乂": [
    { word: "준예", origin: "俊乂", definition: "재주와 덕이 뛰어난 인재." },
  ],
  "趙": [
    { word: "조위", origin: "趙魏", definition: "전국 시대의 조나라와 위나라." },
  ],
  "魏": [
    { word: "조위", origin: "趙魏", definition: "전국 시대의 조나라와 위나라." },
  ],
  "虢": [
    { word: "가도멸괵", origin: "假途滅虢", definition: "길을 빌려 괵나라를 멸한다는 뜻으로, 이용한 상대까지 뒤에 해치는 일을 비유하는 말." },
  ],
  "禹": [
    { word: "우적", origin: "禹跡", definition: "하우가 홍수를 다스리며 남긴 발자취. 또는 그가 다스린 땅." },
  ],
  "岱": [
    { word: "대종", origin: "岱宗", definition: "오악 가운데 으뜸인 태산을 이르는 말." },
  ],
  "雞": [
    { word: "계란", origin: "雞卵", definition: "닭이 낳은 알." },
  ],
  "鉅": [
    { word: "거액", origin: "鉅額", definition: "아주 많은 돈이나 큰 액수. 鉅는 巨와 같은 글자이다." },
  ],
  "邈": [
    { word: "면막", origin: "緜邈", definition: "끝이 보이지 않을 만큼 아득하고 멂." },
  ],
  "穡": [
    { word: "가색", origin: "稼穡", definition: "곡식을 심고 거두는 농사일." },
  ],
  "稷": [
    { word: "사직", origin: "社稷", definition: "토지의 신과 곡식의 신. 나라나 조정을 비유하기도 한다." },
  ],
  "煌": [
    { word: "휘황", origin: "輝煌", definition: "빛이 눈부시게 밝음." },
  ],
  "驤": [
    { word: "용양", origin: "龍驤", definition: "용이 머리를 들고 오르듯 힘차게 달림." },
  ],
  "遼": [
    { word: "요원", origin: "遼遠", definition: "아득히 멀리 떨어져 있음. 遼는 이 말의 첫머리에서 ‘요’로 읽는다." },
  ],
  "阮": [
    { word: "완함", origin: "阮咸", definition: "둥근 몸통과 긴 목을 지닌 중국의 현악기." },
  ],
  "曦": [
    { word: "조희", origin: "朝曦", definition: "아침 햇빛." },
  ],
  "耀": [
    { word: "광요", origin: "光耀", definition: "환하게 빛남." },
  ],
  "璇": [
    { word: "선기", origin: "璇璣", definition: "별의 운행과 위치를 살피던 고대의 천문 기구." },
  ],
  "璣": [
    { word: "선기", origin: "璇璣", definition: "별의 운행과 위치를 살피던 고대의 천문 기구." },
  ],
  "綏": [
    { word: "영수", origin: "永綏", definition: "오래도록 편안함." },
  ],
});
