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

## 普通敵人的動態身分與出場順序

普通敵人不應只靠移動速度或數值區分。每種敵人都應有可辨識、具節奏且克制的 Glyph Body Motion；動作語彙以短促點動、錯拍、停頓與收勢為主，不使用每幀隨機抖動，也不讓所有敵人共用軟綿綿的連續擺動。

首批普通敵人的文字與動態身分為：

- `Z` 代表 `ZOMBIE`：移動時以字形底部為軸心做小幅、不對稱的蹣跚；停止移動時回到中性姿態。
- `BO` 代表 `BONE`：身體以直向兩格排列，`O` 在上作為頭部、`B` 在下作為軀幹；移動時 `B`、`O` 仍以錯開節拍分別顫動，形成短促的骨頭碰撞感，停止移動時回到中性姿態。排列方式不得改寫既有的 Body Motion 策略或每隻 instance 的 deterministic phase offset。
- `BAT`：`A`、`T` 以近乎同拍的上下點動表現拍翼，`T` 稍晚，`B` 只做很小的反向補償，避免整個單字像柔軟布條一起晃動。

首批普通敵人同屬一個發亮／視覺優先階級，但各自使用可辨識的暗色基礎色系：`Z` 使用偏暗綠色系、`BO` 使用暗骨白／中性灰色系、`BAT` 使用偏暗且彩度稍高的深紫色系。正常、直接受擊的 primary feedback 與 `HUSK` 都必須沿用該物種自己的色系；Damage Spread 的專屬 secondary feedback 是明確例外，改為沿用來源玩家攻擊的色系。這裡的「同階級」是指各狀態使用相同的發亮強度與優先順序，不是要求不同色相具有相同的基礎明度或接近一致的最終有效亮度；不得為了數值對齊而把後期怪物調成淺色、粉彩或低彩度。`SLIME` 使用暗而飽和的綠色基底並採 Boss 發亮階級，其亮度強調應比普通敵人稍強，但仍低於玩家攻擊，也不需要把本體調成淺綠。精確 color、alpha、基礎色範圍與發亮強度只存在集中管理且可驗證的 Battlefield Visual Theme config，不在產品文件重複固定數值。

一局開始後，普通敵人的首次出場順序固定為：

```text
Z → BO → BAT
```

Director 必須先依內容定義的 progression 判定目前可出現的種類，再使用 seeded、可重現的選擇規則產生敵人。`BO` 不得早於 `Z` 的初始階段出現，`BAT` 不得早於 `BO`。各階段的精確時間門檻、解鎖後的混合權重與移動速度屬內容調校值，在確認前不得寫死成產品不變量。普通敵人的詳細內容契約記錄在 [`docs/content/ordinary-enemies.md`](docs/content/ordinary-enemies.md)。

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
- State（HEALTHY / DAMAGED / HUSK）
- Rotation
- Offset
- Velocity
- Scale

因此每個字母都可以：

- 受傷
- 變淡
- 劣化為死亡殘骸（`HUSK`）
- 擊退
- 飛散
- 旋轉
- 在生命體整體崩解時飛散、淡出或消失
- 回彈
- 聚合
- 分裂或轉移至其他 Entity，但仍保留同一個 Glyph 身分

不要把字母當成貼圖。把字母當成活著的物件。

---

# Durability

每個 Glyph Cell 都有自己的 Current Durability 與 Max Durability。所有 Enemy、Elite、Boss 的 Glyph Cell 統一經歷以下生命狀態：

```text
HEALTHY（完整）→ DAMAGED（受損）→ HUSK（死亡殘骸）
```

- `HEALTHY`：`Current Durability === Max Durability`。
- `DAMAGED`：`0 < Current Durability < Max Durability`。
- `HUSK`：`Current Durability === 0`，不再具有生命值，也不再接受傷害。

Current Durability 與 Damage Amount 都允許有限的正小數；基礎小怪的 `Max Durability = 1` 不代表最低傷害為 `1`，也不得把每次傷害四捨五入成整數。扣除傷害時必須把結果限制在 `0` 以上，並以一致的數值精度規則消除接近零的浮點殘值。`Max Durability = 1` 的 Cell 只有在單次有效傷害大於或等於剩餘 Durability 時，才會直接由 `HEALTHY` 進入 `HUSK`；較小傷害會留下小數 Current Durability 並進入 `DAMAGED`，不需要為了顯示該階段而增加隱藏耐久。

生命體顯示或對外提供的 HP，只能由 `HEALTHY` 與 `DAMAGED` Glyph Cell 的 Current Durability 加總得出：

```text
Entity HP = sum(HEALTHY and DAMAGED Glyph Cell Current Durability)
Entity Max HP = sum(All Glyph Cell Max Durability)
```

Entity HP 是唯讀的衍生摘要，不是另一份可獨立修改的權威狀態。不得讓 `Enemy HP -= Damage` 與 Glyph Durability 同時存在，也不得用額外的隱藏 HP 讓 Boss 變耐打。

每種生命體的 Body Blueprint 必須明確定義固定 occupied slots；這個 Blueprint 是初始 Cell 數量的唯一來源。內容可以另外提供 Total Max Durability authoring budget，但 LOADING 必須先依可閱讀的耐久圖將它完整編譯成各 Cell 的 Max Durability，且每個初始可見 Cell 至少為 1。額外耐久只加厚既有 Cells，不得增加形狀所需的 Cell 數量。Runtime 不保留可獨立受傷的 total budget。

耐久分布優先使用可辨識的規則，例如中心硬／外圍軟、外殼硬／內部軟、正面硬／背面軟、核心硬或核心脆，以及少數明確裝甲區塊。共用 profile 負責一般分配；特殊生命體可以提供明確 authored map，但不得為每個物種各寫一套隱藏分配演算法。

小怪：

一個字母通常具有 1 點 Durability。以 `BAT` 為例，`B`、`A`、`T` 各自具有 1 點 Durability；普通子彈命中 `B` 後，`B` 直接由 `HEALTHY` 變成低亮度的 `HUSK`，`A`、`T` 仍保持存活。`B` 不會從輪廓或碰撞體積中消失。

Boss：

Boss 的 Glyph 可以具有較高 Durability。較高 Max Durability 的 Cell 應依剩餘 Durability 呈現逐步降低的亮度階段，最後進入 `HUSK`；階段映射由集中 Battlefield Visual Theme config 決定，不在本文固定百分比。因此 Boss 的耐久來自 Glyph Cell 本身，可以非常耐打，同時仍然保持「慢慢被蠶食」的視覺效果。

當 Glyph Cell 的 Current Durability 降至零時，它進入 `HUSK` 狀態。`HUSK` 必須保留極低亮度、Gameplay Glyph ID、Owner、Max Durability、Layout Anchor、變形資料與原本的輪廓位置。`HUSK` 不接受更多 Durability 傷害，但仍是生命體完整輪廓 hitbox 的一部分，也可以對命中播放局部閃光、材質位移與粒子效果。`HEALTHY`／`DAMAGED` Cell 的任何 Durability 恢復都必須來自明確的治療規則，不能偷偷建立額外 HP；`HUSK` 可以隨明確的 body 重組、形變或分裂規則重新排列，但不能恢復 Durability 或復活。

`HEALTHY`、`DAMAGED`、`HUSK` 都參與生命體的完整輪廓碰撞，因此玩家不會在大型怪物接近死亡時只剩一個可命中的字母。生命體仍在戰鬥中時，不得把 `HUSK` 提前轉成 rendering-only fragment，或因為它沒有 Durability 就從 hitbox、Glyph Store 或 Owner 關係中移除。

當一個生命體的所有 Glyph Cell 都進入 `HUSK` 狀態時，該生命體先進入 `COLLAPSING`。崩解期間停止成為攻擊目標、停止接受傷害並移除戰鬥碰撞，整體輪廓才開始飛散與淡出；崩解演出完成後才正式死亡、發放獎勵並清理 Glyph 與 Entity。死亡不是 Entity HP 欄位觸發的另一套規則。

---

# Damage System

玩家的武器不是對 Enemy、Elite 或 Boss 的 Entity HP 造成傷害，而是以 Damage Shape 找出命中的完整 Glyph 輪廓，再從中決定實際降低 Current Durability 的 Glyph Cell：

```text
Glyph Cell Current Durability -= Damage Amount
```

每種武器都必須明確定義 Damage Shape、Damage Radius（或對應的幾何尺寸）、Damage Amount 與單次命中的 target quota 規則。武器差異首先來自命中哪些 Glyph，以及留下什麼壞死形狀，而不只是單一 Damage 數值。

- 普通子彈：Point 或近似 Radius = 0，`targetQuota = 1`。
- 爆炸：Circle / Large Radius，target quota 等於範圍內命中的不同輪廓 Cell 數。
- Railgun：Line 或 Capsule，target quota 等於沿路徑命中的不同輪廓 Cell 數。
- Scatter Shot：Cone，target quota 等於錐形範圍內命中的不同輪廓 Cell 數。

Damage Shape 必須在 Glyph Cell 層級做精確命中判定；不能先扣 Entity HP，再用視覺效果假裝局部字母受傷。每次命中必須明確拆成兩組 Cell：

### Impact Cells

Impact Cells 是 Damage Shape 幾何範圍內的所有 Glyph Cell，包含 `HEALTHY`、`DAMAGED` 與 `HUSK`。它們負責：

- 判定攻擊是否命中完整輪廓 hitbox。
- 在實際命中位置播放局部閃光、材質位移、回彈與粒子效果。
- 提供 AoE 的 target quota；同一個輪廓 Cell 在一次攻擊中只計算一次。

`HUSK` 可以接受上述受擊表現，但其 Current Durability 必須維持為零。

### Damage Targets

Damage Targets 是本次實際降低 Current Durability 的 `HEALTHY` 或 `DAMAGED` Glyph Cell。對每個被 Damage Shape 命中的生命體，選擇規則為：

1. 單體／Point 攻擊的 `targetQuota = 1`；AoE 的 `targetQuota = Damage Shape 內命中的不同輪廓 Cell 數量`。
2. 優先選擇 Damage Shape 內的 `HEALTHY`／`DAMAGED` Cells。
3. 若仍未補足 quota，從被命中的壞死區沿同一 body 的 canonical Glyph topology，依拓撲距離選擇最近的 `HEALTHY`／`DAMAGED` 邊界 Cells。即使剩餘存活 Cell 已位於怪物另一端，只要攻擊命中輪廓 hitbox，仍要正常扣除其 Durability。
4. 每個 `HEALTHY`／`DAMAGED` Cell 在同一次攻擊中最多成為一次 Damage Target；若整個 body 的存活 Cells 少於 quota，就只傷害仍存活的不同 Cells，不把剩餘次數重複疊到最後一格。
5. 等距候選使用穩定的 Glyph ID 次序裁決，確保結果可重現，不得隨機把傷害轉移到無關位置。

Damage Shape 外因 quota 補位而受傷的遠端 Damage Targets 只改變 Durability 與生命狀態；受擊閃光、材質位移、粒子及其他主要命中特效仍只作用於 Damage Shape 內的 Impact Cells，無論那些 Impact Cells 是存活還是 `HUSK`。為了讓玩家讀懂這次同一 body 內的拓撲傷害轉移，Runtime 可以輸出由原命中位置連到遠端 Damage Target 的短暫暗亮細線；它只是一個 rendering-only 關聯提示，不得替遠端 Cell 補上 Material impulse、局部命中粒子或第二次傷害。

### Damage Spread Targets

Damage Spread 是附加在一次直接攻擊上的獨立能力軸，不是放大原本 Damage Shape，也不是 targeting／travel Range。它從該次攻擊**原始 Damage Shape 的整體外緣**向外形成相鄰帶狀範圍；Cone 以整個 Cone 的外圍計算，不得讓每顆火星、每個取樣點或每個 Impact Cell 各自再產生一圈擴散。

- 只有原始 Damage Shape 至少取得一個 Primary Impact Cell 時，該 attack event 才會解析擴散；直接攻擊完全落空時，外圍帶不能隔空造成傷害。
- 每一圈的寬度由集中且可驗證的 `spreadBandWidth` content 參數定義；「一顆 Cell 距離」不綁定任何特定物種的 Glyph spacing。對 Shape 外的正距離 `d`，第 `n` 圈為 `(n - 1) × spreadBandWidth < d ≤ n × spreadBandWidth`。
- Spread Targets 只包含範圍內仍為 `HEALTHY` 或 `DAMAGED` 的 Glyph Cells；`HUSK` 不承受擴散傷害，也不會由 topology frontier 把這份擴散轉移到遠方 Cell。
- 擴散可以跨越 owner。每個帶狀範圍內所有存活 Glyph Cells 都是候選，不只限於直接命中的生命體；若原本生命體的存活 Cells 都不在範圍內，它不吃擴散，但範圍內其他生命體的存活 Cells 仍會受傷。
- Rank I 的第一圈承受主傷害 `20%`；Rank II 的第一、二圈分別承受 `20%`、`10%`；Rank III 的第一、二、三圈分別承受 `20%`、`10%`、`5%`。百分比以該次攻擊已解析的主傷害為基準。
- 同一個 attack event 內，同一 Glyph Cell 最多降低一次 Durability，取所有直接／擴散候選中的最高傷害；直接主傷害與擴散重疊時以主傷害為準。單一 Cone 內部的幾何取樣都共享同一 event，不能讓同一 Cell 重複吃十幾次擴散；Projectile Count 產生的不同 Cone 則是彼此獨立的 attack events，因此重疊區可以各承受一次傷害。
- Spread Targets 必須有可見但與主要 Impact Material response 可區分的受傷回饋。直接 Impact feedback 仍沿用被擊中怪物的 Appearance Profile；spread-only feedback 則沿用該 attack event 已 snapshot 的 `PLAYER_ATTACK_VISUAL_ROLE` 色系，使用該 role 在集中 Battlefield Visual Theme 中設定的 `accent` tint。例如噴火槍的擴散回饋應屬火焰的橘黃系，而不是固定藍色。全域 spread effect 設定只控制 alpha、scale 與 timing，不再提供一個所有武器共用的 tint。除非未來另有明確規則，擴散本身不附帶主要攻擊的局部 impulse 或 whole-body knockback。
- 只有實際成功降低 Spread Target Durability 時才記錄／刷新 spread feedback。若同一 Glyph 在既有回饋尚未結束前又受到不同攻擊 role 的有效擴散傷害，依穩定 attack-event 處理順序由最新一次成功擴散的 role 取代顏色並刷新持續時間；Renderer 不得從 weapon ID、字元或粒子種類反推色系。

---

# Local Damage

Glyph Damage 必須從命中的局部區域開始，並沿著壞死邊界逐步擴張。例如：

玩家一直攻擊 Boss 左肩。只有左肩開始：

- 存活字母逐步變淡並成為 `HUSK`
- `HUSK` 以極低亮度保留局部壞死痕跡
- 壞死區沿 canonical topology 向最近的存活邊界蠶食

而不是整隻 Boss 一起變透明，也不是在未命中的隨機位置產生傷害。若命中範圍已全部壞死，直接傷害仍依上述 quota 與 topology 規則傳到同一 body 最近的存活邊界，直到必要時蠶食到怪物另一端；主要命中特效仍留在實際 Damage Shape 內，遠端只可顯示前述暗亮轉移線。Damage Spread 是另一個明確的空間規則，只有外圍帶內的存活 Cells 取得擴散傷害與擴散專屬回饋，不改寫這套 body topology 行為。

玩家需要感受到："我正在從這裡把它逐步蠶食。"

---

# Material System

每個 Glyph Cell 都具有 Material 與獨立的 Appearance Profile。生命體可以提供預設 Material 與色系，但實際受擊反應仍屬於 Glyph Cell。Material 決定 Durability、擊退、飛散、回彈、聚合、壞死與恢復行為；Appearance Profile 與集中 Battlefield Visual Theme 則決定該物種在正常、直接受擊、受損與 `HUSK` 狀態下的色系與亮度階級。Damage Spread 的 secondary feedback 另外由來源 attack role 決定暫時色系，但不改變 Glyph 的 Appearance Profile。不得為了讓 `Z`、`BO`、`BAT` 顯示不同顏色而複製只改 tint、物理行為完全相同的假 Material。

`HUSK` 不再承受 Durability 傷害，但仍可依其 Material 對局部命中產生位移、回彈與視覺反應；它的低亮度外觀由 Appearance Profile 與視覺階級共同解析，且不得完全隱藏。

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

只要主要 Glyph 的畫面位移會改變生命體的實際姿態或被表現為擊退，不論幅度大小，都必須由 Runtime 擁有，而不是 renderer-only 假位移。結構形變、專屬 Body Motion 與受擊 deformation 是不同來源，不得互相覆寫：

```text
World Glyph Position = Creature Root Position
                     + Layout Anchor
                     + Body Motion Offset
                     + Deformation Offset
```

碰撞與後續攻擊必須使用包含 Body Motion Offset 與 Deformation Offset 的實際位置。Runtime 先更新 Creature Root，再更新結構 Layout Anchor，接著由專屬動態求出當步 Body Motion，最後疊加受擊 deformation。Body Motion 必須從穩定基準與當前節拍重新求值，不得把上一幀結果反覆累加。

`HEALTHY`、`DAMAGED` 與 `HUSK` 在生命體仍處於戰鬥狀態時都跟隨同一套 Body Motion，因此輪廓與 hitbox 不會因 Cell 壞死而脫節；進入 `COLLAPSING` 後才停止戰鬥姿態。受力結束後，Deformation Offset 回到零，但 Cell 仍回到包含當前 Body Motion 的姿態位置。`HUSK` 不會因回彈或姿態動畫而自動復活，也不會因此恢復 Durability。Renderer 可以疊加不影響主要 Glyph 位置的微小閃光或震動，但不能用它取代權威姿態或擊退。

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

史萊姆不是依 Entity HP 門檻憑空分裂成兩隻。局部壞死切斷 canonical Glyph topology 後，足夠大的 `HEALTHY`／`DAMAGED` connected components 才能成為新的 Entity；`HUSK` 保留 Gameplay Glyph 身分與完整輪廓，但不連接存活 topology。未達內容門檻的存活小塊與所有 `HUSK` 仍必須依明確內容規則唯一歸屬並重新聚合到某個 qualifying／最終 body。暫時擊退或形變不會單獨觸發分裂。

注意：不是生成新 HP。
只是：原本所有 Glyph Cell 重新分配到新的 Entity。分裂必須同時滿足：

- Total Glyph Count 不變。
- Total Current Durability 不變。
- Total Max Durability 不變。
- 每個原始 Glyph ID（包含 `HUSK`）恰好屬於一個分裂後的 Entity，不得複製或遺失。

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

爆炸：在命中範圍留下大片低亮 `HUSK`，並沿壞死邊界持續蠶食。

雷電：跳躍破壞。

追蹤分為兩種：

- 一般子彈具有有限度的追蹤修正，但錯過原目標後就是錯過，不會重新鎖定或大角度迴轉。
- 真正的追蹤彈具有更高追蹤效率，失去目標後可以重新尋敵並大角度轉向。

玩家能從 Boss 身上的破壞痕跡，看出自己是哪種 Build。

首版前三把武器的玩法身分已確認：

- Assisted `o` 是遠距、單體、有限修正的基準子彈。
- 噴火槍沿玩家瞄準方向形成約 `90°` 的短程扇形 AREA attack；單一 Glyph 每次承受的傷害低於 assisted `o`，但可以同時侵蝕多個 Impact Cells。橘黃 `.`／`*` 火星是 rendering-only presentation，不是會各自造成傷害的 gameplay projectiles；首版噴火槍不自帶 Fire DoT。
- 能量球以 Printable ASCII `O` 在玩家身邊持續旋轉，單次 Glyph 傷害低於 assisted `o`、高於噴火槍，並將命中的整個 creature root 往玩家外側擊退。軌道、碰撞、重複命中冷卻與 whole-body knockback 都由 Runtime 權威持有，光暈與拖尾才是 rendering-only。

精確 prototype damage、cadence、幾何尺寸與實作順序記錄在 [`docs/content/weapon-system.md`](docs/content/weapon-system.md)，屬於集中管理、可經 playtest 調整的 content defaults。

武器的永久解鎖與單局取得是不同流程：

- 新武器在一場遊戲結束後，回到主選單透過 Meta Progression 永久解鎖。
- 玩家開始一局時，先從已永久解鎖的武器中選擇一把初始武器；選定前不開始 fixed simulation。
- 單局內的新武器只會從本局升級三選一的武器卡取得，且不得出現尚未永久解鎖的武器。
- 首版一局最多裝備三把武器；`3` 是可驗證、可調整的 run/content default，不是散落在各系統的 magic number。
- 裝備已滿時選擇武器卡，玩家可以指定要替換的武器；被替換武器在本局的全部 Module 投資會消失。

武器、單局裝備、混合卡池、Module Slot、覆蓋與升階的詳細產品／工程契約記錄在 [`docs/content/weapon-system.md`](docs/content/weapon-system.md)。

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

通用升級以武器自己的 Module Slots 為投資單位：

- 升級卡可以投資到任何具有明確對應語意的已裝備武器。
- 首版每把武器固定有 `4` 個 Module Slots，數值由 Weapon Definition 明確保存；每個 Module 佔一格。
- 相同 Module 再次投資到同一把武器時，在原 Slot 由 Rank I 升為 Rank II，依此類推至該 Module 的 content-defined 最大 Rank。
- 不同 Module 可以覆蓋指定 Slot；被覆蓋的投資消失，新 Module 從 Rank I 開始。
- Module 不能卸下、退款、搬到另一把武器或重新分配；玩家只能保留、升階或覆蓋摧毀它。
- 覆蓋能力讓後期 Build 可以調整方向，但不能繞過 Weapon Instance、Slot、Rank 或卡片選擇規則。
- 首批已實作的通用 Module 是 Attack Speed、Projectile Count、Damage Spread、Range 與 Knockback，先採 Rank I～III。舊有 Attack Area prototype 只曾用來驗證 Rank／Slot 管線，已由 Damage Spread 取代，不再作為首批玩家能力軸。Rank table 保存各階的完整總效果，不把 Rank II、III 當成對前一階再次疊加；精確 prototype 效果記錄在武器系統文件。
- Range 已進入正式升級卡池，Rank I～III 的完整總倍率依序為 `×1.15`、`×1.30`、`×1.50`。Range 表示武器從玩家向外可到達的距離，不是放大 Damage Spread，也不能以同一個含糊欄位套用所有 AttackPattern：
  - assisted `o` 同時增加初次 target acquisition、維持原目標 lock 的距離，以及沿實際飛行路徑計算的 maximum travel distance；不改 projectile speed、DamageShape radius、修正角度或 steering responsiveness。
  - 噴火槍只延長從 muzzle origin 起算的 authoritative Cone 軸向長度；不改 `90°` 角度、muzzle distance、傷害、pulse interval 或 rendering-only 粒子數。
  - 環繞能量球保留 `80` world-unit 的基礎軌道半徑，Range 只增加 deterministic radial sweep 的最大半徑；Rank I～III 的最大半徑依序為 `92`、`104`、`120`。球的直接傷害半徑維持 `14`，避免把 Range 重新混成 Attack Area。
- Range 與 Damage Spread 同時存在時，Spread 的 `24` world-unit band width 與傷害比例不變；它從該次攻擊已解析的原始 DamageShape 外緣起算。Range 對能量球造成的徑向移動必須使用 authoritative swept collision，不能因 fixed-step 位移跨過 Glyph 而漏判。

---

# Upgrade

升級時：

遊戲完全暫停。
畫面稍微變暗。
中央跳出三張卡片。
三張卡片混合包含已解鎖的新武器與通用 Module；第一次升級保證至少出現一張 eligible 武器卡。
玩家先選卡片，再完成該卡片需要的 target decision：

- Module 卡：選擇投資哪把武器；若沒有相同 Module 且 Slots 已滿，再選擇覆蓋哪個 Slot。
- 武器卡：裝備未滿時取得新武器；裝備已滿時選擇要替換哪把武器。

從選卡、選武器、必要的 Slot／武器 replacement，到 Runtime 驗證並 commit 為止，遊戲都保持完全暫停。只有完整決策成功後，角色才恢復戰鬥或進入下一個 queued upgrade。

XP 升級必須保留超額經驗；一次跨越多個門檻就排入相同數量的 upgrade choices，且連續選擇期間不得短暫恢復 simulation。第一次武器卡保證以第一個實際產生的 offer 為準，不假設一定發生在 Lv.2。首版 XP curve、普通敵人 prototype reward 與前期節奏目標記錄在武器系統文件，之後可以透過 content tuning 調整。

卡片、武器與 Slot 選擇使用 Canvas 上方的 React DOM overlay。React 可以使用 CSS、SVG 或 Web Animations 呈現文字聚合、3D tilt、glitch、neon、code diff 與 Rank compile 動畫；PixiJS 只顯示暫停中的戰場，不決定卡片結果。

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

真正造成傷害的只能是 Runtime 權威的 gameplay attack 與其 Damage Shape／attack event；Projectile、Cone pulse 與 persistent orbit 都可使用這條管線。Rendering-only 粒子、火星、光暈與拖尾永遠不參與傷害或碰撞。

Glyph 儘量使用：Texture Atlas，而不是每幀建立 Text。

Creature Body Motion 必須能隨大量 Glyph 擴張：每個 active creature 每個 fixed step 只計算一次節拍、移動強度與必要的 motion-group transforms，再把結果寫入既有 Glyph storage。不得在熱路徑建立暫時物件、陣列或 closure，不得逐 Cell 取亂數，也不得為了動畫做 topology／鄰居搜尋。成本上限應與 active creatures 加實際參與動畫的 Glyph 數線性相關，不得形成 creatures × all Glyphs 的巢狀掃描。

Body Motion 造成的最大位移必須納入 broad-phase footprint；Render Snapshot 與 PixiJS Adapter 只同步必要的 position／rotation 數值，沿用 Glyph Atlas、batch 與 view pool，不為每隻怪或每個動作建立額外 Text、Container 或一次性 display objects。壓力驗證沿用 `AGENTS.md` 的普通戰鬥與 Boss stress populations，且不得為了效能把權威動態降級成與碰撞不一致的 renderer-only 位移。

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

8. 血量來自 Glyph Cell，傷害作用於 Glyph Cell，武器使 Glyph Cell 逐步劣化為 `HUSK`，Boss 分裂只重新分配 Glyph Cell；生命體在全部 Glyph Cell 成為 `HUSK` 後進入整體崩解，崩解完成才死亡與清理。

# 企劃補充案：代碼概念升級與視覺可讀性優化

## 一、 戰利品與 Build 的新型態：開發者語意升級 (Developer Semantics Upgrades)

為了深化「Everything is Text」的核心理念，三選一的卡片升級與 Build 系統除了功能性的數值改變（如：子彈 +1）之外，在**視覺名稱與升級概念**上，將直接採用工程師熟悉的**代碼語意與字型屬性**。

戰場中的 Gameplay 物件由 Canvas/PixiJS 系統渲染；升級卡片本身則是 React DOM overlay，可以使用實際的 CSS／SVG 動畫。借用代碼語意與字型屬性命名能強化遊戲的獨特風格（Indie Flair），讓玩家一目了然，同時提供極具直覺的視覺回饋。

### 核心字型與渲染屬性升級卡片設計範例

| 卡片名稱 (Concept)      | 遊戲內實際機制效果 (Gameplay Effect)                                                | 戰場中的 PixiJS 視覺回饋 (Visual Feedback)                                                        |
| :---------------------- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **【Color: Fire Red】** | **屬性賦予：** 武器獲得「燃燒/熔岩」屬性，攻擊時對 Glyph 造成持續性傷害。           | 子彈與被擊中的敵方文字區塊轉變為由 Battlefield Visual Theme 提供的熾熱紅色系，並帶有微弱的灰燼粒子。 |
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

不可讓所有文字使用相同視覺強度。戰場中所有 Canvas／PixiJS 基礎色彩、alpha 與發亮階級由一份集中、可驗證的 Battlefield Visual Theme config 管理；基礎色的色相／彩度／明度與 Gameplay 呈現的發亮強度是兩個分離維度。本文所稱「明度」是 palette 本身由暗到淺的色調性質，「亮度／發亮階級」則是 Gameplay role 的視覺強調程度，兩者不得互相代替。本文只定義相對順序與色彩語意，不保存固定色碼。

為了方便人工調色，Battlefield Visual Theme 的 authoring config 中所有顏色一律使用 `#RRGGBB` 字串，alpha 另以獨立數字設定。遊戲只在 `LOADING／prepareGameContent()` 嚴格驗證字串格式並轉換一次；進入 READY 前即產生 immutable prepared theme，之後 Runtime、render snapshot 與 PixiJS 只接收 24-bit numeric tint。不得在 fixed step、逐 Glyph 或逐幀路徑解析字串，也不得接受縮寫色碼、含 alpha 色碼或 CSS 顏色名稱。只要是合法 `#RRGGBB`，Runtime 不得再因色相、彩度、明度、狀態亮度順序或跨角色亮度上限阻止載入；這些視覺層級屬於瀏覽器實機調校目標。玩家攻擊 role 的 `accent` 同時是該 role 的 Damage Spread 色系來源，因此調整攻擊 palette 時，其擴散回饋必須自動跟隨，不另維護一份 spread tint。

- **最高視覺優先權：玩家與玩家攻擊。** 玩家必須隨時可辨識；玩家攻擊是其他戰場元素不可超越的亮度上限。
- **經驗值掉落：短暫醒目、長期克制。** 經驗值剛生成時呈黃色，短時間後過渡為暗金色；進入穩定狀態後只以低 duty-cycle、彼此錯開的短促閃爍提醒玩家。新生狀態與閃爍峰值都不得達到或超過玩家攻擊的亮度階級，且大量掉落物不得同步閃爍造成畫面噪音。
- **Boss：高於普通敵人、低於玩家攻擊。** Boss 的正常與受擊發亮強度都比普通敵人稍高，以保留重量感與威脅辨識，但不能蓋過玩家及其攻擊；較高階級不得靠把基礎色洗成淺色來達成。
- **普通敵人：同一發亮階級、不同暗色基底。** `Z` 為偏暗綠色系、`BO` 為暗骨白／中性灰色系、`BAT` 為偏暗且彩度稍高的深紫色系。三者共享普通敵人的狀態強調順序與發亮幅度，而不共享絕對明度；直接受擊發亮與 primary 粒子必須留在各自色系內，不得全部閃成同一種白色或紅色，也不得為了對齊亮度而變成粉彩色。Damage Spread 的 secondary feedback 依來源玩家攻擊 role 的 accent 色系呈現，不受這條怪物 primary palette 規則限制。
- **低優先權元素：** 穩定狀態的暗金經驗值、`HUSK`、背景文字與靜態障礙物依序使用更克制的階級；`HUSK` 仍需保留可讀輪廓，背景則維持全場最低的視覺優先權。

視覺調校仍應分開觀察三件事：基礎色是否符合暗色／彩度語意、同一 profile 內的狀態發亮順序是否清楚，以及最終畫面是否超過全域上限。不得以「同階級」為由要求 `Z`／`BO`／`BAT` 疊加背景後的有效亮度落在狹窄誤差內；同階級只共享發亮強度與角色順序。玩家攻擊上限、XP 新生／閃爍峰值與怪物受擊峰值等跨類別安全界線應在瀏覽器中依實際背景、色彩與 alpha 做視覺確認，但不作為 content preparation 的拒絕條件。精確色值、alpha、發亮強度、過渡時間、閃爍週期與 duty cycle 都屬可調 config，不得複製到本文或其他內容文件。

### 2. 邊框與字體陰影（Stroke & Drop Shadow）機制

在 PixiJS 渲染層，為關鍵 Gameplay 物件加上一層由 Battlefield Visual Theme 提供的低亮度中性外框（Stroke）或陰影，將字母與底色背景徹底剝離：

- 玩家文字與核心子彈使用集中設定的外框色與厚度，不在文件或 renderer 內重複固定值。
- 即使玩家不小心走進由文字組成的 Boss 身體裡，因為玩家字母帶有由 Theme 定義的高對比外框，在視覺上仍會像一個「浮在 Boss 表面」的獨立物件，絕不與 Boss 的字母混在一起。

### 3. 動態動能與粒子淡出 (Velocity-Based Alpha fading)

- **非 Gameplay 粒子不擋視線：** `HEALTHY`、`DAMAGED` 與 `HUSK` Glyph 在生命體仍處於戰鬥狀態時都必須保留 Gameplay 身分；`HUSK` 不得因為 Durability 為零而提前移除 hitbox 或轉為純視覺粒子。只有生命體的全部 Glyph 都成為 `HUSK`、Runtime 明確進入 `COLLAPSING` 並移除該生命體的戰鬥碰撞後，崩解中的 Glyph 才可依死亡規則轉為 rendering-only fragments。
- **快速淡出：** `COLLAPSING` 產生的飛散碎片在離開生命體核心主體後，其透明度（Alpha）應在 0.2 至 0.5 秒內呈指數型（Ease-out）變淡並消失，避免碎裂的英文字母長時間堆積在畫面上干擾走位判斷。崩解演出完成後才執行正式死亡獎勵與清理。

### 4. 相對靜止與動態對比 (Motion Contrast)

- 玩家的移動與子彈的噴射是高頻率的**線型動態**。
- 地圖背景（如果未來有設計背景文本）或靜態障礙物，必須保持完全靜止並使用 Battlefield Visual Theme 的最低亮度階級，利用「動與靜」的物理視覺差，自然而然地引導玩家的視線焦點。
