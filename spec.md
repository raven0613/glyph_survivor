# Project: Text Survivor (Working Title)

## 核心理念 (Core Vision)

這是一款 **Survivors-like / Bullet Heaven** 遊戲，整個世界由文字所構成。

玩家的第一印象應該是：「整個世界都是文字。」

所有戰鬥生命體（Enemy、Elite、Boss）都由 Glyph Cell 組成。Glyph Cell 不是美術效果，而是生命體的最小生命與戰鬥單位；整個戰鬥系統必須以 Glyph Cell 為中心，而不是以傳統 Entity HP Bar 為中心。

---

# Gameplay

## 玩家操作

- WASD 控制角色移動。
- 滑鼠控制射擊方向。
- 游標停止移動後保留最後射擊方向；只有再次移動游標時才更新射擊角度，讓玩家能固定方向並專心移動角色。
- 武器自動攻擊。
- 大部分武器具有自動追蹤能力。
- 玩家不需要一直點擊攻擊。
- 升級時遊戲完全暫停。

---

## Combat

玩家主要樂趣：

- 躲避大量敵人。
- 建立 Build。
- 快死時升級。
- 升級後瞬間反殺。

遊戲節奏：

> 壓力增加
>
> ↓
>
> 快死
>
> ↓
>
> 升級三選一
>
> ↓
>
> Build 成形
>
> ↓
>
> 爽快反殺
>
> ↓
>
> 更高難度

這是整款遊戲最重要的核心循環。

---

# World

整個世界都由文字組成。

包含：

- 玩家
- 敵人
- Boss
- 子彈
- 爆炸
- 粒子
- 特效
- 掉落物
- UI

盡量不要使用一般圖片素材。
世界觀維持一致：
Everything is Text.

---

# Enemy Design

敵人不是貼圖。
敵人身體本身由文字組成。

所有 Enemy、Elite、Boss 都必須由一個或多個 Glyph Cell 組成，不得建立繞過 Glyph Cell 的第二套生命值或受傷模型。

例如：

SLIME Boss

由大量 SLIME 重複排列形成身體。

例如：

SLIMESLIMESLIME...

玩家是在破壞文字本身。不是打圖片。

---

# Glyph System

每個文字 (Glyph) 都是一個可獨立控制的 Cell。

每個 Glyph 具有：

- Character
- Local Position
- Current Durability
- Max Durability
- Alpha
- Material
- State（Alive / Destroyed）
- Rotation
- Offset
- Velocity
- Scale

因此每個字母都可以：

- 受傷
- 變淡
- 被摧毀
- 擊退
- 飛散
- 旋轉
- 消失
- 回彈
- 聚合
- 分裂或轉移至其他 Entity，但仍保留同一個 Glyph 身分

不要把字母當成貼圖。把字母當成活著的物件。

---

# Durability

每個 Glyph Cell 都有自己的 Current Durability 與 Max Durability。生命體顯示或對外提供的 HP，只能由目前所有存活 Glyph Cell 的 Current Durability 加總得出：

```text
Entity HP = sum(Alive Glyph Cell Current Durability)
Entity Max HP = sum(All Glyph Cell Max Durability)
```

Entity HP 是唯讀的衍生摘要，不是另一份可獨立修改的權威狀態。不得讓 `Enemy HP -= Damage` 與 Glyph Durability 同時存在，也不得用額外的隱藏 HP 讓 Boss 變耐打。

每種生命體的 Body Blueprint 必須明確定義固定 occupied slots；這個 Blueprint 是初始 Cell 數量的唯一來源。內容可以另外提供 Total Max Durability authoring budget，但 LOADING 必須先依可閱讀的耐久圖將它完整編譯成各 Cell 的 Max Durability，且每個初始可見 Cell 至少為 1。額外耐久只加厚既有 Cells，不得增加形狀所需的 Cell 數量。Runtime 不保留可獨立受傷的 total budget。

耐久分布優先使用可辨識的規則，例如中心硬／外圍軟、外殼硬／內部軟、正面硬／背面軟、核心硬或核心脆，以及少數明確裝甲區塊。共用 profile 負責一般分配；特殊生命體可以提供明確 authored map，但不得為每個物種各寫一套隱藏分配演算法。

小怪：

一個字母通常具有 1 點 Durability。以 `BAT` 為例，`B`、`A`、`T` 各自具有 1 點 Durability；普通子彈命中並摧毀 `B` 後，身體會局部剩下 `AT`。

Boss：

Boss 的 Glyph 可以具有較高 Durability。例如某個 Max Durability 為 5 的 Cell，其受傷亮度階段可以是：

100% → 80% → 60% → 40% → 20% → Destroyed

因此 Boss 的耐久來自 Glyph Cell 本身，可以非常耐打，同時仍然保持「慢慢被蠶食」的視覺效果。

當 Glyph Cell 的 Current Durability 降至零時，它進入 Destroyed 狀態。依內容機制，它可以消失、飛散、生成掉落物，或由特定 Boss 機制以同一個 Glyph 身分重新聚合；任何恢復 Durability 的行為都必須是明確的治療或重組規則，不能偷偷建立額外 HP。

當一個生命體的所有 Glyph Cell 都進入 Destroyed 狀態時，該生命體死亡。死亡不是 Entity HP 欄位觸發的另一套規則。

---

# Damage System

玩家的武器不是對 Enemy、Elite 或 Boss 的 Entity HP 造成傷害，而是以 Damage Shape 找出命中的 Glyph Cell，並降低各自的 Current Durability：

```text
Glyph Cell Current Durability -= Damage Amount
```

每種武器都必須明確定義 Damage Shape、Damage Radius（或對應的幾何尺寸）與 Damage Amount。武器差異首先來自命中哪些 Glyph，以及留下什麼破壞形狀，而不只是單一 Damage 數值。

- 普通子彈：Point 或近似 Radius = 0，只傷害實際命中的 Glyph Cell。
- 爆炸：Circle / Large Radius，同時傷害範圍內所有 Glyph Cell。
- Railgun：Line 或 Capsule，沿路徑傷害所有命中的 Glyph Cell。
- Scatter Shot：Cone，傷害錐形範圍內所有 Glyph Cell。

Damage Shape 必須在 Glyph Cell 層級做精確命中判定；不能先扣 Entity HP，再用視覺效果假裝局部字母受傷。

---

# Local Damage

Glyph Damage 永遠必須是局部的。例如：

玩家一直攻擊 Boss 左肩。只有左肩開始：

- 字母變淡
- 字母消失
- 被轟出洞

而不是整隻 Boss 一起變透明。

玩家需要感受到："我正在把這裡打穿。"

---

# Material System

每個 Glyph Cell 都具有 Material。生命體可以提供預設 Material，但實際受擊反應屬於 Glyph Cell；Material 決定 Durability、擊退、飛散、回彈、聚合、破壞與恢復行為。

例如：

- Slime：容易飛散、容易聚合、擊退幅度大。
- Rock：Durability 高、幾乎不擊退、緩慢崩壞。

Material 不能只改整個 Entity 的透明度或播放一個無關 Gameplay 的動畫。它必須影響被命中的局部 Glyph Cell。

---

# Hit Feel

重型攻擊命中時：附近 Glyph：

- 短暫震開
- 飛散
- 再聚回原位

形成：果凍/磁力/材質的感覺。
Boss 必須具有重量感。不是單純 HP 減少。

只要主要 Glyph 的畫面位移被表現為擊退，不論幅度大小，都必須是 Runtime 的權威 deformation，而不是 renderer-only 假位移：

```text
World Glyph Position = Creature Root Position + Layout Anchor + Deformation Offset
```

碰撞與後續攻擊必須使用包含 Deformation Offset 的實際位置。Alive Glyph 在受力結束後回到當前 Layout Anchor；Creature 移動或形變時 Anchor 可以持續更新。Destroyed Glyph 不會因回彈而自動復活或補洞。Renderer 可以疊加不影響主要 Glyph 位置的微小閃光或震動，但不能用它取代權威擊退。

---

# Boss

Boss 名稱就是玩法。例如：

SLIME

特色：

- 字母具有黏性
- 可分裂
- 被打散後慢慢聚回

GOLEM

特色：

- 字母非常硬
- 幾乎不擊退
- 慢慢崩壞

GHOST

特色：

- 字母透明
- 容易散開
- 可重新組合

SNAKE

特色：

- 長條身體
- 可打斷
- 身體各段可獨立活動

每個 Boss 都應具有：

自己的文字材質。

自己的死亡方式。

自己的受擊方式。

---

# Split Boss

部分 Boss 可分裂。例如：

SLIME

史萊姆不是依 Entity HP 門檻憑空分裂成兩隻。局部破壞切斷 canonical Glyph topology 後，足夠大的 Alive connected components 才能成為新的 Entity；未達內容門檻的小塊仍保留 Gameplay Glyph 身分，並重新聚合到某個 qualifying／最終 body。暫時擊退或形變不會單獨觸發分裂。

注意：不是生成新 HP。
只是：原本所有 Glyph Cell 重新分配到新的 Entity。分裂必須同時滿足：

- Total Glyph Count 不變。
- Total Current Durability 不變。
- Total Max Durability 不變。
- 每個原始 Glyph ID 恰好屬於一個分裂後的 Entity，不得複製或遺失。

因此玩家不會因為 Boss 分裂而需要重新造成更多傷害。

SLIME 首版使用根 Body Blueprint 的初始 Cell 數量作固定比例基準；精確形狀、30% 門檻、連通性、眼睛與重新聚合規則記錄在 [`docs/content/slime-boss.md`](docs/content/slime-boss.md)。

---

# Weapon Design

武器不只是傷害不同。不同武器應具有不同：

- Target Logic
- Attack Shape
- Destruction Shape

例如：

普通子彈：打最近敵人。

穿透：打一整條。

散彈 ：打一大片。

爆炸：炸出大洞。

雷電：跳躍破壞。

追蹤分為兩種：

- 一般子彈具有有限度的追蹤修正，但錯過原目標後就是錯過，不會重新鎖定或大角度迴轉。
- 真正的追蹤彈具有更高追蹤效率，失去目標後可以重新尋敵並大角度轉向。

玩家能從 Boss 身上的破壞痕跡，看出自己是哪種 Build。

---

# Build

Build 是遊戲第二核心。

不是單純：

Damage +10%

而是：

玩法改變。

例如：

- 更多子彈
- 更大子彈
- 擊退
- 穿透
- 分裂
- 雷射
- 連鎖
- 爆炸
- 環繞
- 軌道武器

每局都應能形成完全不同玩法。

---

# Upgrade

升級時：

遊戲完全暫停。
畫面稍微變暗。
中央跳出三張卡片。
玩家點擊選擇。

選擇後：

角色恢復戰鬥。
升級是整個遊戲最重要的節奏點之一。

---

# Rendering

Renderer：

PixiJS。

React 僅負責：

- UI
- Menu
- Settings
- Upgrade Screen

不要使用 React 每幀更新遊戲物件。

---

# Performance

所有粒子：使用 Object Pool。

視覺粒子：不參與碰撞。

真正造成傷害的：只有 Gameplay Projectile。

Glyph 儘量使用：Texture Atlas，而不是每幀建立 Text。

---

# Visual Language

所有東西盡量使用：

ASCII / Alphabet。

例如：

子彈：

o

O

I

>

掉落：

-

$

-

爆炸：

O

Boss：

SLIME

GOLEM

等等。整個世界保持一致設計語言。

---

# Prototype Priority

第一版不要追求大量內容。

優先驗證：

① Survivors-like 核心是否好玩。

② Build 是否有差異。

③ 快死 → 升級 → 反殺 是否爽。

④ Glyph 被破壞是否具有滿足感。

⑤ Boss 是否具有重量感。

只要這五點成立，再開始擴充內容。

---

# 設計原則

1. Gameplay 永遠優先於美術。

2. 玩家要能從畫面直接讀懂傷害。

3. 字母不是裝飾，而是玩法。

4. Boss 名稱就是 Boss 機制。

5. 每種 Build 都要留下不同的破壞痕跡。

6. 玩家分享影片時，最吸引人的應該是：
   「整隻文字 Boss 被一點一點轟碎、切裂、飛散、重組。」

這應成為整款遊戲最具辨識度的特色。

7. 任何新戰鬥功能都應先回答「它如何作用於 Glyph Cell」，而不是「它如何修改 Entity HP」。例如：
   - 火焰：持續降低 Glyph Durability。
   - 冰凍：改變 Glyph Material 反應，使 Glyph 不易飛散。
   - 腐蝕：持續降低 Durability，並讓受影響的 Glyph 逐步變淡。
   - 雷電：沿鄰接關係同時傷害多個 Glyph Cell。
   - 黑洞：吸引、位移並扭曲 Glyph Cell。

8. 血量來自 Glyph Cell，傷害作用於 Glyph Cell，武器摧毀 Glyph Cell，Boss 分裂只重新分配 Glyph Cell；生命體死亡就是其 Glyph Cell 全部被摧毀。

# 企劃補充案：代碼概念升級與視覺可讀性優化

## 一、 戰利品與 Build 的新型態：開發者語意升級 (Developer Semantics Upgrades)

為了深化「Everything is Text」的核心理念，三選一的卡片升級與 Build 系統除了功能性的數值改變（如：子彈 +1）之外，在**視覺名稱與升級概念**上，將直接採用工程師熟悉的**代碼語意與字型屬性**。

雖然遊戲底層由 Canvas/PixiJS 系統渲染（不使用實際的網頁 CSS），但借用這些命名能強化遊戲的獨特風格（Indie Flair），讓玩家一目了然，同時提供極具直覺的視覺回饋。

### 核心字型與渲染屬性升級卡片設計範例

| 卡片名稱 (Concept)      | 遊戲內實際機制效果 (Gameplay Effect)                                                | Canvas/PixiJS 實際渲染與視覺表現 (Visual Feedback)                                                |
| :---------------------- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **【Color: Fire Red】** | **屬性賦予：** 武器獲得「燃燒/熔岩」屬性，攻擊時對 Glyph 造成持續性傷害。           | 子彈與被擊中的敵方文字區塊轉變為熾熱的螢光紅（`#FF3366`），並帶有微弱的灰燼粒子。                 |
| **【Size: 200%】**      | **體積倍增：** 子彈或武器的判定範圍、體積大幅度增加，傷害等比例提升。               | 調高字型大小（`fontSize`），子彈字母（如 `o` 變成 `O`，甚至巨大的 `0`）體積膨脹，視覺震撼感極強。 |
| **【Letter Spacing】**  | **散射間距：** 針對多發散射（Spread）或分裂子彈，增加子彈與子彈之間的擴散軌道間距。 | 增大排版間距（`letterSpacing`），彈幕的橫向覆蓋範圍變寬，更容易進行大面積的雜魚清場。             |
| **【Text Shadow】**     | **殘影連擊：** 子彈後方依附 1-2 個具備延遲判定的「文字影子」，造成二次傷害判定。    | 啟用陰影渲染（`dropShadow`），子彈後方帶有高透明度的色彩殘影，在畫面上拉出漂亮的字體光軌。        |
| **【Weight: Bold】**    | **擊退與重量：** 大幅提升子彈的「衝擊力/重量感」，能將敵方 Glyph 震得更遠。         | 字體變更為粗體（`fontWeight: 'bold'`），被擊中的 Boss 文字結構會產生更劇烈的物理彈開反饋。        |
| **【Opacity】**         | **穿透特化：** 子彈獲得穿透能力，每次穿透一個 Glyph 傷害遞減，但能貫穿複數敵人。    | 調低子彈的透明度（`alpha`）使其呈半透明狀，如幽靈般直接穿透文字身體，沿途破壞留下一條彈道軌跡。   |
| **【Rotation/Spin】**   | **軌道環繞：** 武器轉化為環繞角色旋轉的「防禦型軌道字體」。                         | 每幀動態更新字體的角度（`rotation`），字體圍繞玩家角色高速旋轉，形成一圈文字防護壁。              |

---

## 二、 視覺疲勞與可讀性優化 (Readability vs. Chaos)

由於整個遊戲世界（包含玩家、敵人、子彈、特效、掉落物）完全由 ASCII 字母組成，當畫面進入中後期、Build 成形且怪物海湧入時，極易陷入「資訊超載」與「角色丟失」的混亂狀態（Chaos）。

為了確保**「玩家在任何時候都能一眼找到自己」**並**「清晰讀懂傷害反饋」**，必須建立嚴格的視覺層級（Visual Hierarchy）規範：

### 1. 顏色對比度與色彩層級 (Color Hierarchy)

不可讓所有文字使用相同亮度。透過色彩飽和度與明度（HSL/RGB）將畫面劃分層級：

- **第一層級（最高亮、最顯眼）：**
  - **玩家角色** 與 **玩家核心子彈**。永遠使用高飽和度的顏色（如螢光綠 `#00FF66`、電光藍 `#00CCFF`、`#FFFFFF`）。
- **第二層級（中度醒目）：**
  - **高價值掉落物**（如 `$`、`*`）與 **升級提示**。採用閃爍（Blinking）或具有微幅呼吸效果的金黃色（`#FFCC00`）。
- **第三層級（暗色/底層）：**
  - **普通敵人與 Boss**。平時維持在中等明度的冷色調或特定警示色（如暗紅 `#993333`、鐵灰 `#666666`）。
  - 這樣能確保即使畫面上有一萬個字母，玩家的眼睛也能直覺捕捉到生存空間。

### 2. 邊框與字體陰影（Stroke & Drop Shadow）機制

在 PixiJS 渲染層，為關鍵 Gameplay 物件加上一層極微小的單色外框（Stroke）或黑影，將字母與底色背景徹底剝離：

- 玩家文字與核心子彈強制開啟 `stroke: '#000000'` 與 `strokeThickness: 3`。
- 即使玩家不小心走進由文字組成的 Boss 身體裡，因為玩家字母帶有黑色外框，在視覺上仍會像一個「浮在 Boss 表面」的獨立物件，絕不與 Boss 的字母混在一起。

### 3. 動態動能與粒子淡出 (Velocity-Based Alpha fading)

- **非 Gameplay 粒子不擋視線：** 只有已進入 Destroyed 狀態且不再參與重組的 Boss 字母碎片，才可在飛散時移除傷害判定並轉為純視覺粒子。仍存活、可受傷或可重新聚合的 Glyph Cell 必須保留 Gameplay 身分，不得因渲染效果而提前失去權威狀態。
- **快速淡出：** 這些飛散的碎片在離開 Boss 核心主體後，其透明度（Alpha）應在 0.2 至 0.5 秒內呈指數型（Ease-out）變淡並消失，避免碎裂的英文字母長時間堆積在畫面上干擾走位判斷。

### 4. 相對靜止與動態對比 (Motion Contrast)

- 玩家的移動與子彈的噴射是高頻率的**線型動態**。
- 地圖背景（如果未來有設計背景文本）或靜態障礙物，必須保持完全靜止且極度暗淡（例如明度低於 15% 的暗灰色），利用「動與靜」的物理視覺差，自然而然地引導玩家的視線焦點。
