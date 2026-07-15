# Player Survival — Health, Shields, Death, and Run Results

> 狀態：生存、統計、結算／回主畫面、玩家生命／護盾受擊 presentation、任何完整 Gameplay 暫停後的恢復無敵、死亡回看、手動進入結算與跨局清理均已實作並完成回歸驗證。本文件不保存任何可調數值的 default；數值只存在對應的 validated config／content。

本文是玩家生命、護盾、incoming damage、接觸碰撞、死亡、單局統計、結算畫面與回主畫面流程的唯一詳細入口。跨系統產品意圖以 [`spec.md`](../../spec.md) 為準，依賴方向與 lifecycle 架構以 [`AGENTS.md`](../../AGENTS.md) 為準；未來生存 Module 的 ordered Slot transaction 另須遵守 [`weapon-system.md`](weapon-system.md)。

## 1. 本里程碑範圍

本次要完成：

- Runtime-owned Player Survival state 與集中 config；
- Health、Shield Layers、shield recharge 與 global damage invulnerability；
- 從任何完整 Gameplay 暫停恢復至戰場時的共用 player resume invulnerability；
- 玩家和普通怪／Boss 權威 Glyph 輪廓的接觸受傷；
- 生命受擊、護盾常駐／受擊／回復的 rendering-only 玩家 presentation；
- 玩家死亡、`DEATH_REVIEW` 戰場回看、手動進入 `GAME_OVER`、不可變 run result 與停止 simulation；
- 每局時間、正式擊殺數、Weapon Instance 傷害／裝備時間／平均 DPS 統計；
- React HUD、結算畫面與回到主畫面的完整流程。

本次不實作：

- 怪物投射物與其 presentation；
- 藥水、生命自動回復、最大生命、護盾流派等卡片或掉落物；
- 直接攻擊生命值的實際怪物內容；
- 廣告 SDK、廣告請求或假廣告內容。

## 2. 權威狀態與邊界

Player Survival state 是 `WorldState` 的 plain Runtime data，由 fixed-step systems 獨占寫入。它至少表達：

- current／maximum Health；
- current／maximum Shield Layers；
- 最近一次被接受受擊的 simulation timestamp；
- global damage invulnerability 結束的 simulation timestamp。

玩家 Health 不由 Glyph Cell 構成，也不套用 Enemy／Elite／Boss 的 `HEALTHY → DAMAGED → HUSK` 規則。Pixi display objects、React state 與 UI snapshots 都不是生存狀態的寫入來源。

React 只讀取 UI-sized immutable summaries 並送出明確 command。Renderer 可以呈現玩家受擊或死亡，但不得決定 incoming hit 是否成立、護盾是否破裂、Health 是否歸零或何時進入 `GAME_OVER`。

## 3. Config 是唯一數值來源

玩家生存的 authoring values 集中在 `src/game/runtime/gameConfig.ts` 的 `GAME_CONFIG`，由 loading／host boundary 驗證後以 immutable prepared config 注入 Runtime。實作至少加入以下欄位；本文只定義語意，不保存 default：

| Config field | 語意與驗證 |
| --- | --- |
| `initialPlayerHealth` | 開局 current 與 maximum Health；必須是有限正值 |
| `initialPlayerShieldLayers` | 開局 current 與 maximum Shield Layers；必須是有限非負整數 |
| `shieldRechargeIntervalMs` | 每回復一層護盾所需的連續未受擊 RUNNING simulation time；必須是有限正值 |
| `playerDamageInvulnerabilityMs` | 一次受擊被接受後的 global incoming-damage gate 時長；必須是有限正值 |
| `playerResumeInvulnerabilityMs` | 一局中從任何完整 Gameplay 暫停 phase 回到 `RUNNING` 時，至少保證的全域受傷無敵時長；必須是有限正值 |
| `playerCollisionRadius` | 玩家權威圓形接觸判定半徑；必須是有限正值 |
| `playerDeathFallDurationMs` | 致命傷成立後，玩家 Glyph 從站立轉至躺地姿態所需的 death-review time；必須是有限正值 |
| `playerDeathGroundedDurationMs` | 玩家完全躺地後，顯示「進入結算」操作前必須經過的 death-review time；必須是有限正值 |
| `deathReviewEnemyWanderIntervalMs` | `DEATH_REVIEW` 中每隻怪物重新選擇無目標游走方向的間隔；必須是有限正值 |
| `deathReviewEnemyWanderSpeedMultiplier` | `DEATH_REVIEW` 無目標游走速度相對於各 Creature Definition maximum speed 的倍率；必須是有限正值 |
| `deathReviewEnemyWanderTurnResponsiveness` | `DEATH_REVIEW` 中目前速度轉向下一個游走方向的平滑響應；必須是有限正值 |

Creature contact damage 保留在各 validated Creature Definition 的 `contactDamage`，不搬入 Player config，也不在本文、Boss sheet 或 enemy sheet 複製。未來 hostile projectile 的 damage／routing 由 projectile content authoring。戰鬥色彩、alpha、光暈、粒子、震動與 hit feedback timing 仍由集中 combat visual theme 管理；本文只保存淺藍護盾等語意身份，不保存色碼、時間、數量、距離、速度或強度 default。

任何後續新增的可調生存數值，都必須先成為有名稱、可驗證的 config／content field；不得寫在 system magic number、React component、renderer 或文件範例中。

## 4. Health 契約

- current Health 必須是有限非負 Gameplay number；maximum Health 必須是有限正值，且 current 不得大於 maximum。
- 開局以 `initialPlayerHealth` 同時建立 current 與 maximum Health。
- 有效 Health damage 以同一個集中精度規則扣除並 clamp 至零；不得因浮點殘值延後死亡。
- 未來治療只能透過明確 Runtime transaction 增加 current Health，且不得超過當下 maximum。
- 未來增加 maximum Health、效果被覆蓋或武器被替換時，current Health 如何變動尚未定案；本里程碑不得偷偷實作任一比例補血或扣血規則。
- current Health 歸零時玩家死亡，無論 current Shield Layers 為何。

## 5. Shield Layers 契約

- current 與 maximum Shield Layers 都是非負整數，且 current 不得大於 maximum。
- 開局以 `initialPlayerShieldLayers` 同時建立 current 與 maximum Shield Layers。
- 一層護盾完整承受一次被接受的 attack event。它不依 damage amount 拆分，也不把同一 event 的剩餘傷害 spill 到 Health。
- 護盾擋下攻擊仍算一次被接受受擊：它啟動 global invulnerability、重設 shield recharge，並可在未來發出 shield-hit／shield-broken domain event。
- current Shield Layers 低於 maximum 時，從最近一次被接受受擊起累積 RUNNING simulation time。每到達一個 `shieldRechargeIntervalMs` 就回復一層並繼續計算下一層，直到 maximum。
- 回復排程必須保留 fixed-step overflow，不能因一步跨過多個 interval 就丟失已到期的層數。
- Shield 已滿時不預存 recharge progress；之後的 accepted hit 必須從新的受擊 timestamp 重新等待。
- 同一步若既達到 recharge threshold 又收到 accepted hit，先解析 incoming damage 並重設 recharge，不會先補出一層來阻擋該次攻擊。
- `READY`、任何完整 Gameplay 暫停 phase、`DEATH_REVIEW` 與 `GAME_OVER` 都不推進護盾回復或 global invulnerability；護盾回復與無敵期限都只讀 RUNNING simulation time，不讀 wall-clock time。

## 6. Incoming Player Damage

所有玩家受傷來源都先建立 Runtime-owned incoming-damage candidate，至少包含 stable event/source identity、source kind、finite positive damage amount 與明確 route：

- `SHIELD_FIRST`：若 current Shield Layers 尚有層數，消耗一層並完全阻擋該 event；否則扣 Health。
- `HEALTH_ONLY`：略過 Shield Layers，直接扣 Health。此 route 供未來明確標記的怪物能力使用，本里程碑沒有實際內容。

接受順序如下：

1. 只在 `RUNNING` 且玩家尚未死亡時處理 candidate。
2. 非正 damage、無效 source 或重複 event 不成立，也不得啟動任何計時。
3. 玩家仍在 global invulnerability 期間時忽略 candidate；被忽略事件不消耗護盾、不扣 Health，也不重設 shield recharge。
4. 同一 fixed step 有多個合法 candidate 時，依 prepared source-kind ordinal、stable source ID、stable event ID 的順序排序；第一個被接受的事件立即啟動 global invulnerability，因此其餘事件重新通過相同 gate，而不是繞過 gate 批次扣除。
5. 被接受事件依 route 原子修改 Shield／Health，記錄最近受擊 simulation timestamp，並把 invulnerability deadline 設為 config 定義的時間。
6. 修改後立即檢查 Health；死亡條件不能等到 render frame 或 React effect 才成立。

敵方投射物之後加入時只能新增 source adapter，不能建立另一套玩家扣血、無敵或護盾邏輯。

本里程碑所有 creature contact candidates 使用 `SHIELD_FIRST`。未來若某個接觸、投射物或主動能力要直接攻擊 Health，必須由該攻擊 content 明確 author `HEALTH_ONLY`，不能由物種名稱、Glyph 字元或 renderer presentation 推測。

### 暫停後恢復無敵

- 「完整 Gameplay 暫停」指由權威 game phase 明確停止一般 `RUNNING` fixed simulation 的狀態。現在的 `PAUSED_MENU` 與 `PAUSED_UPGRADE` 都屬於此分類；未來新增其他暫停原因時，必須加入同一個集中 phase classification／transition contract，不得各自在升級、選單或其他 feature handler 裡複製一份恢復無敵邏輯。
- 只有一局進行中，權威 phase 實際由上述暫停分類轉回 `RUNNING` 時才授予恢復無敵。`READY → RUNNING` 的初次開局、`GAME_OVER` 後的新局、`DEATH_REVIEW`、只顯示但不停止 simulation 的 overlay，以及重複送出的 resume command 都不成立。
- 連續 queued upgrade decisions 全程仍是同一段 `PAUSED_UPGRADE`；卡片之間不得短暫進入 `RUNNING` 或重複授予無敵。只有最後一個 authoritative decision commit、phase 真正恢復 `RUNNING` 時才授予一次。
- 恢復無敵必須在下一個 `RUNNING` fixed step 的輸入、移動、碰撞與 incoming damage 解析之前寫入 Runtime survival state，不得留下可在恢復首幀受傷的空窗。
- 恢復時把 global invulnerability deadline 延長到「目前 RUNNING simulation time 加上 `playerResumeInvulnerabilityMs`」，並與既有 deadline 取較晚者；不得縮短暫停前尚未結束的受擊無敵。暫停期間不消耗任一 deadline，若恢復後再次進入暫停，剩餘時間仍隨 RUNNING clock 凍結。
- 恢復無敵沿用同一個 global incoming-damage gate，對 `SHIELD_FIRST` 與未來 `HEALTH_ONLY` 都有效。期間被忽略的 candidate 不消耗 Shield、不扣 Health、不加入 accepted event IDs，也不重設 shield recharge。
- 授予恢復無敵本身不是 accepted hit：不得改寫 `lastAcceptedDamageAtMs`、不得重排 `nextShieldRechargeAtMs`、不得產生 Health／Shield 受擊 presentation revision，也不得影響擊殺、DPS、Gameplay time 之外的統計。
- 本契約目前不新增獨立的無敵視覺效果；是否需要提示另行定案。Renderer 與 React 不得從 pause overlay 消失時間自行決定 Gameplay 無敵期限。

## 7. 怪物接觸碰撞

- 接觸 broad phase 使用 creature prepared footprint，precise phase 則比較 config 定義的玩家圓形 hitbox，與怪物每個權威 outline Glyph 的 collision geometry。
- Glyph world position 必須包含 creature root、layout anchor、Body Motion 與 Material deformation。Renderer position 不得回寫或代替判定。
- `HEALTHY`、`DAMAGED` 與 `HUSK` 在 owner 仍具 Gameplay collision 時都參與完整輪廓；局部變成 Husk 不會縮小玩家面對的接觸範圍。
- 同一 creature owner 即使同時有多個 Glyph 接觸玩家，每個 fixed step 也只產生一個 contact candidate，damage amount 來自該 prepared Creature Definition 的 `contactDamage`。
- 不同 owners 產生不同 candidates，再交由全域 stable ordering 與 invulnerability gate 決定是否接受。
- 目前只有明確具戰鬥碰撞的 active creature phases 會造成接觸候選。文字聚合生成、`COLLAPSING`、`INACTIVE`、`DEAD`／`DEFEATED` 不造成玩家傷害；Slime `REASSEMBLING` 沿用其已確認的 Gameplay collision 契約。
- 接觸查詢在 fixed step 內必須位於權威 root movement、Body Motion 與 deformation position 更新之後。

## 8. 玩家受擊 Presentation

玩家受擊 presentation 只能回應 Runtime 已接受並解析完成的 incoming-damage outcome，不得從 HUD 數值差、Sprite overlap、物種名稱或 renderer 自行碰撞推測。Runtime／render snapshot 必須提供足以區分 Health damage、Shield absorb、Shield depleted 與 Shield restored 的 stable presentation identity／revision；同一 outcome 不得因重複 render snapshot 再觸發一次。

### 生命受擊

- 只有實際降低 current Health 的 accepted hit 才觸發生命受擊效果。被 global invulnerability 忽略、被 Shield 完整吸收或無效的 candidate 都不觸發。
- 生命受擊由玩家 Glyph 短暫閃爍、rendering-only 的 `.` Glyph 碎片，以及玩家 Glyph 的局部小震動組成。
- `.` 碎片不具 collision、damage、targeting、drop 或其他 Gameplay identity，也不得進入 WorldState entity stores。其數量可由 visual config 設為零，以便完整停用而不留下 dormant Gameplay branch。
- 局部震動只能疊加在玩家的 render position；不得改寫玩家權威座標、camera、hitbox、aim origin 或後續攻擊位置。

### 護盾常駐外觀

- current Shield Layers 大於零時，玩家周圍只顯示一對括號，組成 `(@)` 的語意外觀；括號是獨立於玩家 `@` 的 rendering-only Glyph views。
- 無論 current Shield Layers 是一層或多層，都只顯示一對括號。精確 current／maximum 層數仍由 HUD 表達，不以重疊括號編碼。
- 護盾具有淺藍色語意身份與輕微光暈。具體 base／glow color、alpha 與其他數值只存在集中 combat visual theme authoring config，不得複製到本文、Runtime system、render adapter 或 React SCSS。
- 左右括號各自擁有一團以該括號本身為中心的獨立霧面光暈。兩團光可以在空間上自然相接，但不得先合成一個以玩家 `@` 為中心的共同 aura，也不得以模糊括號副本製造可辨識的實體殘影。

### 護盾受擊與回復

- 只有實際消耗一層 Shield 的 accepted hit 才觸發護盾受擊效果；它不播放生命受擊的閃爍、`.` 碎片或玩家 Glyph 震動。
- 消耗後仍有至少一層 Shield 時，只讓常駐括號短暫震動。括號不得 fade out，且不得生成第二對常駐括號。
- 消耗最後一層 Shield 時，括號先短暫震動，再各自向玩家外側位移並 fade out；左括號向左、右括號向右。效果完成後不再保留括號 view。
- current Shield Layers 由零回復為正值時，左右括號由玩家中心開始，在淡入的同時向外展開至各自常駐位置。已經有常駐括號時，其他層數回復不疊加第二對括號或重播出現動畫。
- 未來 `HEALTH_ONLY` hit 即使在 Shield 尚存時成立，也只播放生命受擊效果；既有護盾括號保持不變。

### Presentation config 與生命週期

- Health flash、`.` 碎片、Health shake、Shield base、Shield glow、Shield hit shake、depletion fade／offset 與 restore fade／offset 的全部可調參數，都必須是集中 visual theme 的具名、可驗證欄位。不得在 renderer hot path 或本文加入 magic number。
- 所有 authoring color literal 仍只允許存在於集中 theme config，並遵守既有嚴格色彩格式；文件只描述語意色彩身份與相對用途。
- Renderer 可以 pool／reuse 括號、碎片與光暈 views，但不能讓上一局的 active effect 或 revision 穿過 `returnToMainMenu`。下一局必須從 initial Shield state 重新建立正確外觀。
- Presentation 可以在不影響 Gameplay 的範圍內插值與 easing；是否受擊、扣除哪種資源、剩餘 Shield Layers 與何時回復仍完全由 Runtime 決定。

## 9. 玩家死亡與 phase 優先序

```text
RUNNING → DEATH_REVIEW（轉身 → 躺地等待 → 顯示按鈕；戰場持續動態）
        → enterRunResult → GAME_OVER
```

- Health 歸零只提交一次 player-death transition，建立死亡當下的 immutable run result，並把全域 phase 從 `RUNNING` 轉為 `DEATH_REVIEW`；不得在致命傷當下直接顯示結算畫面。
- 一旦 transition 成立，不再開始下一個一般 `RUNNING` fixed simulation step；同一 RAF callback 尚未執行的 RUNNING catch-up steps 必須停止並切換至 phase-specific death-review scheduler，避免多執行一次玩家攻擊、傷害、掉落、統計或 upgrade。
- 已在死亡當步正式 commit 的傷害、擊殺、裝備時間與死亡結果保留並立即凍結。`DEATH_REVIEW` 經過的時間不屬於本場 Gameplay time，也不得改寫 death-time run result。
- 若死亡與 level-up／upgrade trigger 落在同一 fixed step，死亡優先。不得先開啟或保留 `PAUSED_UPGRADE` overlay，也不得消耗 pending upgrade transaction。
- `DEATH_REVIEW` 不是全域暫停。玩家移動、輸入、武器 emission、player-owned authoritative attacks、incoming player damage、XP／upgrade、掉落獎勵與所有 run statistics 停止；玩家不再具有可受擊或可造成傷害的 Gameplay 身分。
- 為保留可截圖的活戰場，死亡當下已存在的怪物仍由 Runtime 繼續其移動、Body Motion、materialization、reassembly 與已開始的 collapse presentation，rendering-only 戰場效果也可繼續。Director 不再生成新怪，且這段回看不得產生新的 combat damage、reward、XP、kill count 或 run-result mutation。
- 進入 `DEATH_REVIEW` 時，所有怪物必須立即解除玩家 target；不得繼續讀取玩家的死亡座標、把倒地玩家當作 steering target，或因此逐漸聚集在屍體周圍。`ACTIVE` 怪物改用 phase-specific 的無目標游走，`MATERIALIZING`／`REASSEMBLING` 怪物完成既有階段後也進入同一游走；已進入 `COLLAPSING` 的怪物只完成崩解 presentation，不重新取得移動行為。
- 無目標游走由 Runtime 依 run seed、stable Creature ID 與 death-review time 產生彼此錯開的方向，使用各物種既有 maximum speed／Body Motion 身分，再套用 death-review config 的速度、轉向與換向間隔。切換 phase 時不得瞬移或把速度歸零，而是從當下 velocity 平滑轉向第一個游走方向；移動仍須留在既有 world bounds 內。相同 seed 與狀態必須可重現；不得每幀取亂數、共同追逐一個隱藏 wander target，或讓 Renderer 私自位移怪物。
- `DEATH_REVIEW` 使用獨立、可重現且受 frame-delta clamp 保護的 review clock；它可以執行上述窄化 scheduler，但不得推進 RUNNING gameplay clock、invulnerability、shield recharge 或 Weapon Instance equipped time。Camera 保持死亡位置，玩家輸入不能移動畫面。
- 致命傷仍先播放同一筆 Health hit feedback；玩家 Glyph 隨後以自身為中心轉四分之一圈至躺地姿態。旋轉進度由 Runtime／render snapshot 的 stable death presentation identity 與 review elapsed time 驅動，Renderer 不得自行決定完成時點，且不得改寫玩家死亡座標。
- 玩家完全躺地後，必須再等待 `playerDeathGroundedDurationMs`，才由 `UiSnapshot` 將 `canEnterRunResult` 切為 true，並由 React 顯示「進入結算」按鈕。按鈕出現後仍停留在 `DEATH_REVIEW`，戰場動態繼續，不得自動倒數進入結算。
- 「進入結算」送出明確 `enterRunResult` command；Runtime 只在 `DEATH_REVIEW` 且 `canEnterRunResult` 為 true 時接受，並原子轉入 `GAME_OVER`。重複、過早或其他 phase 的 command 必須安全拒絕且不得重播死亡 side effects。
- 只有進入 `GAME_OVER` 後才停止 death-review scheduler 並顯示 React-owned 結算畫面。`GAME_OVER` 不再推進 AI、Body Motion、collapse presentation 或其他戰場動態。
- 重複 damage、phase publication 或 React remount 不得建立第二份 result、重複計入統計或再次執行死亡 side effects。
- `DEATH_REVIEW`／`GAME_OVER` phase 與已存在的 immutable run result 可以作為 transition／side-effect idempotency guard，但不得成為能否決 Health 歸零死亡條件的第二份 combat truth。

## 10. Run Statistics

### Gameplay time 與擊殺

- 本場時間只累積 `RUNNING` fixed-step simulation time。`READY`、任何完整 Gameplay 暫停、`DEATH_REVIEW` 與 `GAME_OVER` 不計時。
- 普通怪與未來 Elite 只在整體 collapse 完成並正式進入 reward-authorizing death state 時各計一次擊殺。
- Boss 以 Encounter 正式 `DEFEATED` 時計一次，不因 root／child bodies、分體或多份 cleanup 重複增加。
- 玩家死亡當下仍在 `COLLAPSING`、尚未正式死亡／`DEFEATED` 的怪物不列入擊殺數。

### Weapon Instance 傷害歸屬

- 每個 damaging attack 在 emission snapshot 保存 stable `sourceWeaponInstanceId`。Damage System 在 mutation 後回報每個 Glyph 實際減少的 Current Durability，累加到該 Instance。
- Total Damage 是實際套用的 Glyph Durability delta，包含 primary direct targets、topology-frontier direct targets 與 Damage Spread targets。
- Miss、Husk Cell 本身沒有發生的 durability delta、同 event 去重、overkill 被 clamp 的部分、純 knockback、Material displacement、particles 與其他 presentation 不計入 Total Damage；由 Husk impact 導向 living topology-frontier target 的實際 durability delta 仍須計入。
- 統計以 stable Weapon Instance ID 隔離，不以 Weapon Definition ID 合併。同 definition 再次取得仍是新的 Instance，建立獨立且歸零的 counter。
- 武器替換後，舊 Instance 的獨立在途攻擊仍歸舊 Instance；傷害不得搬到 replacement。Runtime 可保留 retired record 直到在途 attribution 安全結束，但死亡結果只 filter 當下 loadout 中的 Instances，因此被替換武器不顯示。

### 裝備時間與平均 DPS

- Weapon Instance equipped gameplay time 從它正式 commit 到 loadout 開始，到被替換或玩家死亡為止，只累積 `RUNNING` fixed-step simulation time。
- 沒有怪物可攻擊、武器在 cooldown、攻擊 miss 或玩家只在走位時，仍屬於裝備中 Gameplay time。任何完整 Gameplay 暫停與結算不計入。
- 結算顯示的指標明確命名為「裝備期間平均 DPS」，計算時先把該 Instance 的 equipped gameplay time 正規化為秒，再以 Total Damage 除之。沒有正的 equipped gameplay time 時，Runtime result 使用 unavailable／`null`，UI 顯示無資料，不執行除以零。
- 為避免把它誤讀成理論武器 DPS，每張武器結果同時顯示 Total Damage 與 equipped gameplay time，並標示只統計目前裝備的該 Weapon Instance。

### 最高傷害裝飾

- 只比較死亡當下仍裝備的 Weapon Instances，依 Total Damage 選出最高者，顯示金色裝飾與小皇冠。
- Total Damage 相同時，較早正式取得／commit 的 Instance 勝出；若 acquisition order 仍相同，以 stable Weapon Instance ID 決定。
- 所有可比較武器都沒有造成傷害時不頒皇冠。

## 11. Run Result、HUD 與結算 UI

Bridge 的 immutable `UiSnapshot` 在遊戲中提供 UI-sized survival summary：current／maximum Health、current／maximum Shield Layers、phase、`canEnterRunResult` 與既有 HUD values。只在值改變或既有低頻 publication cadence 發布，不能為 death animation 每個 render frame 更新 React state；逐幀 death presentation progress 只走 render snapshot。

Run result 在致命傷成立時已建立並凍結，但只在接受 `enterRunResult`、進入 `GAME_OVER` 時才作為結算資料對 React 發布：

- 本場 Gameplay time；
- 正式擊殺數；
- 最終 Player Level；
- 死亡當下仍裝備的 Weapon Instances，維持 loadout order；
- 每把武器的 identity／名稱、stable instance ID、ordered Module Slots、各 Module 名稱與 Rank；
- 每把武器的 Total Damage、equipped gameplay time、裝備期間平均 DPS，以及是否取得最高傷害裝飾。

沒有 Weapon Level 欄位；「modules 和等級」只指各 Slot 的 Module Rank。Run result 不含 Glyph arrays、projectiles、retired weapons、Pixi objects 或 mutable Runtime references。

`DEATH_REVIEW` 中的 React 只能在 `canEnterRunResult` 成立後顯示輕量的「進入結算」操作，不得提前掛載 GameOver panel、全畫面遮罩、暗幕或會暫停 Canvas 的 modal。操作位置不得遮住玩家死亡位置與主要戰場構圖，讓玩家可以在動態戰場上截圖後再自行進入結算。

結算是 React-owned DOM screen，視覺語言、字體、panel、按鈕與動態風格應延續首頁。它可以覆蓋已停止的 Canvas，但不得從 render snapshot 反推統計。畫面結構預留未來廣告版位的 extension point；本里程碑不載入 SDK、不發請求，也不顯示偽造廣告。

## 12. 回到主畫面

結算頁的按鈕送出明確 `returnToMainMenu` command。Runtime／Host 只在合法 phase 接受，並以一個 lifecycle transaction：

- 丟棄本局 WorldState、pending upgrades、run statistics、run result 與輸入狀態；
- 清空本局 Glyph、creature、projectile、effect、death-review clock／prompt 與玩家死亡 presentation，將 active render views 解除同步並歸還既有 pool，不保留可在下一局觸發的 event；
- 回到 `READY`／主畫面與初始武器選擇流程；
- 保留可安全重用的 GameHost、Pixi Application、prepared content、visual theme 與永久解鎖 snapshot，避免整頁 reload。

下一局建立全新的 Weapon Instance IDs／counters 與生存狀態。舊局的傷害、擊殺、時間、invulnerability deadline 或 shield recharge progress 都不得洩漏。重複 command 必須有定義且不得重複 dispose 資源。

## 13. 未來生命／護盾 Module 卡

以下只是已確認的擴充方向，不是本里程碑 content：治療／自動回復、增加 maximum Health、增加 maximum Shield Layers、縮短護盾回復時間、shield hit／shield broken 觸發效果，以及其他護盾 Build。

這些卡未來仍是 `MODULE` choice，必須指定一個 Weapon Instance，並像通用武器 Module 一樣占用 ordered Slot、同類升 Rank、可被覆蓋，且隨該 Weapon Instance 被替換而摧毀。Player-wide 效果從目前裝備 Slots 聚合，不得改成不占欄位的永久被動，也不得轉移到 replacement weapon。

正式實作前仍需由產品定案：各 Module Definition／Rank table、同類與跨武器疊加、maximum Health／Shield 降低時 current values 的調整、shield broken event timing，以及效果覆蓋／替換與死亡同一步的優先序。在這些規則確認前，不得把卡加入 offer pool、建立 UI preview，或先做 dormant Runtime branch。

## 14. 必要驗證

純規則與高風險 deterministic tests 應覆蓋：

- config validation 拒絕不合法 Health、Shield、受擊／恢復無敵 duration 與 collision radius；
- 一層護盾完整吸收一次 `SHIELD_FIRST` event，且不 spill 到 Health；
- `HEALTH_ONLY` 明確略過仍存在的護盾；
- 被接受的 shield hit 重設 recharge 並啟動 invulnerability，被 invulnerability 忽略的 hit 不會；
- shield recharge 只讀 RUNNING simulation time、保留 interval overflow 並停止於 maximum；
- 同 owner 多 Glyph 接觸只產生一個 candidate，Husk 仍參與 active outline；
- 多 owner 同步接觸使用 stable ordering，且不能在同一 invulnerability window 批次扣血；
- `PAUSED_MENU`、`PAUSED_UPGRADE` 與未來註冊在同一 pause classification 的 phase，只有在實際轉回 `RUNNING` 時才於下一個 fixed step 前授予一次 resume invulnerability；初次開局、非暫停 overlay 與重複 resume 不授予；
- queued upgrades 中途不短暫恢復或重複授予；最終恢復時的 deadline 與既有受擊無敵取較晚者，且不改寫 accepted-hit identity、受擊 presentation 或 shield recharge 排程；
- resume invulnerability 期間的 `SHIELD_FIRST`／`HEALTH_ONLY` candidates 都被同一 global gate 忽略，期限結束後下一個合法 candidate 才可正常成立；
- Health 歸零優先進入 `DEATH_REVIEW`，停止剩餘 RUNNING catch-up steps 並壓過同一步 upgrade；
- `DEATH_REVIEW` 凍結 death-time result／Gameplay time／Weapon equipped time；既有怪物立即解除玩家 target 並進入 deterministic、per-creature 錯開的無目標游走，Body Motion 與允許的 lifecycle presentation 持續，且不產生新 damage、reward、XP、kill 或 statistics mutation；
- death-review wander 不讀取玩家死亡座標、切換時不瞬移或突然歸零速度，且遵守 world bounds；相同 seed／Creature IDs 可重現，不同怪物不會同步換向或共同聚集至同一隱藏 target；
- 玩家 Glyph 依 snapshot-owned progress 轉四分之一圈，完全躺地並經過 config 定義的 grounded duration 後才發布一次 `canEnterRunResult`；在此之前與之後都不得自動進入結算；
- `enterRunResult` 只有在 prompt ready 時能把 `DEATH_REVIEW` 原子轉成 `GAME_OVER`，過早／重複 command 安全無副作用；
- kill count 只在正式 death／Boss Encounter defeat 增加，玩家死亡時未完成 collapse 不計；
- actual Glyph Durability delta 正確歸屬 stable Weapon Instance，排除 overkill、Husk Cell 本身未發生的 delta 與純 presentation，同時保留 living topology-frontier target 的實際傷害；
- replacement weapon 從空 counter 開始，舊在途 attack 不轉嫁，結果只列 death-time loadout；
- equipped time 包含 RUNNING 中沒有目標的時間，但排除所有 pause／result time；
- average DPS、tie-break、all-zero no-crown 與 immutable result snapshot；
- `returnToMainMenu` 清除舊 World／result 並讓下一局從乾淨狀態開始。
- global invulnerability 忽略的 hit 不產生 Health／Shield presentation revision，重複 render snapshot 也不重播已消費的 revision；
- Health damage 只觸發 flash、可停用的 `.` 碎片與 render-local shake，且不改變權威玩家／camera 座標；
- Shield 尚有剩餘層數時只有括號震動、沒有 fade out；最後一層消耗時才震動並向兩側 fade out；
- 任意正 Shield Layers 都只保留一對常駐括號，左右各有以自身為中心的獨立霧面光暈；零到正值的回復由中心淡入展開，正值間的層數回復不疊出另一對；
- `HEALTH_ONLY` hit 在 Shield 尚存時不破壞或重播護盾括號，回主畫面與下一局也不殘留 presentation views。

瀏覽器實機驗收另外確認 HUD 可讀性、生命受擊辨識度、`.` 碎片密度、玩家局部震動手感、左右護盾獨立霧面光暈與括號在常駐／受擊／耗盡／回復時的可讀性、死亡轉身與躺地節奏、死亡回看期間怪物解除追蹤後自然且不同步的無目標游走、怪物不聚集於玩家屍體、截圖構圖、「進入結算」操作、首頁與結算頁視覺一致、responsive layout、keyboard／pointer 操作，以及 reduced-motion 路徑。任何實機調整出的數值仍只回填 config／content，不回填本文。
