# 趣味イラスト40種類：シンプルなA案（2026-10-05）

## 制作方針

ユーザーが採用した `hobby-simple-a-refined.png` をスタイル参照にし、全40種類を個別に built-in image generation tool で生成した。背景の描写を抑え、大きな形、少ない陰影、クリーム・セージ・テラコッタを中心とした手描きの質感で統一する。

- 各趣味は1枚の横長イラスト。同じ画像を一覧・詳細・選択画面に使う。
- 配布画像は960×540pxのWebP（quality 84）。生成PNGは元の `generated_images` に保持する。
- アプリでは画像URLに `v=20261005-simple-a` を付け、旧画像のキャッシュを更新する。
- 画像ID、趣味タグ対応表、人物の保存設定は引き継ぐ。夕暮れシティと既存のCSS表紙は今回の差し替え対象外。

## 共通プロンプト

```text
Use case: illustration-story / style-transfer. Asset: ONE final standalone full-bleed landscape 16:9 raster illustration for a Japanese people notebook, not a sheet. Image 1 is ONLY the approved STYLE REFERENCE: reproduce its degree of simplification, palette, flat hand-painted gouache shapes, soft imperfect edges and subtle paper grain. Use the requested subject, not all three reference subjects. Broad 4–6 muted colors, 1–2 flat shadows, warm cream / sage / terracotta / tan / pale slate. Main object should be instantly recognizable at 56px thumbnail size, substantially simpler than realistic painted scenes. No fine texture detail, intricate lighting, gradients, 3D, photorealism, realistic scenery, generic corporate icon or emoji. One quiet ground stripe and one plain background color; at most ONE broad background rectangle. No peripheral decor. Center the main identifying object within the middle 40% of the canvas horizontally, around the vertical center, leave quiet space to both sides. Keep it recognizable both in a central portrait crop and a very wide short central cover crop. Entire canvas filled with the painted background, NO paper frame, borders, rounded frame, contact sheet, grid, text, labels, logo or watermark. No people or faces except simple requested animals or original tiny creature. Output only ONE landscape artwork.
```

## 個別の被写体とファイル

### サッカー (`soccer`)

- 配布画像: `soccer.webp`
- 生成PNG: `exec-8f102b94-d27e-40ad-99c8-9a53200c9320.png`

```text
one black-and-cream soccer ball, bold pentagons, on a sage grass stripe; pale sage background. No stadium or goal, no trees.
```

### 読書 (`reading`)

- 配布画像: `reading.webp`
- 生成PNG: `exec-c9732494-7bc3-4106-8ab7-c673de5ab533.png`

```text
one open book with deep green cover, two large cream page planes and only three broad tan marks for writing; flat terracotta tabletop and a single pale warm wall rectangle. Match the reference's top panel closely.
```

### 登山・ハイキング (`hiking`)

- 配布画像: `hiking.webp`
- 生成PNG: `exec-d345d1ba-c4c8-48e4-a42a-f38226fd4873.png`

```text
a simple pair of tan hiking boots together, a single slate blue mountain silhouette behind with one cream snowy cap. No forest, no detailed trail, no many peaks.
```

### ゴルフ (`golf`)

- 配布画像: `golf.webp`
- 生成PNG: `exec-7114e672-0490-4118-bfdf-df5d44e9f509.png`

```text
one cream golf ball in front of a dark green putter head, on a sage putting-green stripe. A single short muted terracotta flag if needed. No distant course, trees or sunset.
```

### 旅行 (`travel`)

- 配布画像: `travel.webp`
- 生成PNG: `exec-3a7383ef-7e2f-40a0-8660-601952155f69.png`

```text
one small terracotta suitcase with a simple handle and one tan luggage tag, on a quiet cream surface against pale blue. No map text, planes, landmarks or landscape.
```

### 車 (`car`)

- 配布画像: `car.webp`
- 生成PNG: `exec-43e85bdb-43d3-46ab-adfc-3b493679064d.png`

```text
one slate blue compact hatchback in clear three-quarter side view, two simple dark wheels, cream windows, no interior details; tan road stripe, pale sage background. No winding road, mountains or trees.
```

### ランニング (`running`)

- 配布画像: `running.webp`
- 生成PNG: `exec-edf7d8ee-a435-4835-9ff0-944e77c3d3b3.png`

```text
a pair of cream running shoes with sage accents, broad simple lace marks and soles, on a terracotta ground stripe with a pale cream background. No track stadium or scenery.
```

### 音楽 (`music`)

- 配布画像: `music.webp`
- 生成PNG: `exec-79ad5d85-3754-40c5-9bba-df21f8eff2a3.png`

```text
one warm ochre acoustic guitar, simple cream sound-hole ring and only a few broad string lines, upright diagonally with body centered against pale sage, flat tan ground. No studio decor.
```

### コーヒー (`coffee`)

- 配布画像: `coffee.webp`
- 生成PNG: `exec-fcaf5cf3-918a-48ba-b2e5-eaada3cad059.png`

```text
one sage ceramic cup holding coffee, a cream saucer and just three coffee beans, large simple dark coffee oval and one curl of steam, terracotta tabletop, pale cream wall. No plant, pastries or coffee machine.
```

### 釣り (`fishing`)

- 配布画像: `fishing.webp`
- 生成PNG: `exec-aeee37f9-c429-401c-b776-de1b44a202cb.png`

```text
one simple ochre fishing reel and the short handle of a slate fishing rod, one clearly recognizable cream-and-sage fish-shaped fishing lure, pale blue background, tan ground stripe. No lake or landscape, no complex line loops.
```

### 料理 (`cooking`)

- 配布画像: `cooking.webp`
- 生成PNG: `exec-f9030684-41a0-40b7-b310-1ca78c752505.png`

```text
one sage cooking pot with lid slightly ajar and two simple broad steam curves, one red tomato beside it, terracotta tabletop, pale cream wall. No kitchen appliances or many ingredients.
```

### 園芸 (`gardening`)

- 配布画像: `gardening.webp`
- 生成PNG: `exec-c0fb8c66-5f12-4ef7-8ae5-b7ba5b3a93c0.png`

```text
one terracotta plant pot with five broad sage leaves and a simple tan gardening trowel, cream background and tan ground stripe. No flowers, tiny foliage or garden scenery.
```

### 野球 (`baseball`)

- 配布画像: `baseball.webp`
- 生成PNG: `exec-73571e5d-341f-45d9-a3b6-4d1f052062b7.png`

```text
one warm terracotta baseball glove holding a large cream baseball with simple reddish dashed seams, slate pale blue background, tan ground stripe. Match the reference middle panel. No bat or baseball field, no glove lacing.
```

### ジム・筋トレ (`gym`)

- 配布画像: `gym.webp`
- 生成PNG: `exec-f19d1672-4fc0-48e4-bf96-ace619526e00.png`

```text
two simple charcoal dumbbells with rounded broad weight shapes, centered on a flat sage mat, pale warm cream background. No gym benches, racks or room scenery.
```

### お酒 (`alcohol`)

- 配布画像: `alcohol.webp`
- 生成PNG: `exec-58b6acc2-a435-456e-9b7a-8cf6015d7abb.png`

```text
one glass mug of warm golden beer with a single cream foam shape, and a small stemmed wine glass with one flat reddish fill, on a tan countertop and sage background. No bottles, bar interior or realistic glass reflections.
```

### 映画 (`movie`)

- 配布画像: `movie.webp`
- 生成PNG: `exec-f602aed1-cf84-44c5-9a1f-251072de469a.png`

```text
one terracotta-and-cream striped popcorn carton and one slate clapperboard with simple diagonal cream marks, no lettering, against pale blue with a tan tabletop. No theater rows, screen, film still or words.
```

### 犬 (`dog`)

- 配布画像: `dog.webp`
- 生成PNG: `exec-e6056493-9842-4435-bbaf-71b0f5056574.png`

```text
one friendly small tan dog lying calmly on a sage cushion, broad flat tan-and-cream body shapes and simple eyes, ears, paws. Cream background and one pale warm wall rectangle, no fur detail, toy or room decor.
```

### 猫 (`cat`)

- 配布画像: `cat.webp`
- 生成PNG: `exec-ef48f3c6-14de-4ea5-ac83-9007c083662e.png`

```text
one curled sleeping ginger cat on a sage cushion, a few broad terracotta stripes, simple closed eyes and whiskers. Closely match the reference bottom panel. Cream background and one pale warm wall rectangle, no fur realism or room decor.
```

### ペット (`pet`)

- 配布画像: `pet.webp`
- 生成PNG: `exec-c37b885d-1155-4e74-ad0b-513be3d94bf9.png`

```text
one tan dog and one ginger cat resting close together on one sage cushion, each face clearly visible, broad calm shapes, simple small eyes. Pale cream background and tan ground. No other animals or toys.
```

### アイドル・推し活 (`idol`)

- 配布画像: `idol.webp`
- 生成PNG: `exec-2339aac3-cb1b-451c-acaa-e06590aa00a4.png`

```text
two simple concert glow sticks in muted peach and sage, crossed slightly beside one small round cream handheld fan with a single terracotta heart. Slate pale blue background. No faces, performer, fan lettering or decorative confetti.
```

### ガチャガチャ (`gacha`)

- 配布画像: `gacha.webp`
- 生成PNG: `exec-4c73cfd3-334f-469d-8c1c-e72fbba0699d.png`

```text
one unbranded cream-and-sage capsule toy vending machine, a broad round globe containing only six colorful circles, a simple handle, one terracotta-and-cream capsule at its base. Pale warm background. No writing, signage or toy figures.
```

### テニス (`tennis`)

- 配布画像: `tennis.webp`
- 生成PNG: `exec-d797685d-3df0-4b0b-a761-4a8d3a10b8e0.png`

```text
one simple slate tennis racket with sparse broad crossed strings and two pale yellow tennis balls, sage surface and cream background. No court net, landscape or tiny string mesh.
```

### バスケットボール (`basketball`)

- 配布画像: `basketball.webp`
- 生成PNG: `exec-34779231-f66e-4725-bed3-d48b8df27dab.png`

```text
one large warm orange basketball with only four broad dark curved seam lines, on a tan ground stripe against pale blue. No hoop, gym or court details.
```

### 自転車・サイクリング (`cycling`)

- 配布画像: `cycling.webp`
- 生成PNG: `exec-7139dd14-f408-4dd2-91b0-c2982a4e4d02.png`

```text
one simple sage bicycle in side view, two dark circular wheels, cream inner discs, broad frame lines and tan seat, centered against pale cream with a terracotta ground stripe. No spokes, accessories or scenery.
```

### 水泳 (`swimming`)

- 配布画像: `swimming.webp`
- 生成PNG: `exec-774b9d25-ffed-4f3c-9747-7f4b5fc3a152.png`

```text
one pair of slate swimming goggles with two broad pale blue lens shapes and a folded sage swim cap, on a tan ground stripe against a calm pale blue background. No pool lanes or realistic reflections.
```

### ヨガ (`yoga`)

- 配布画像: `yoga.webp`
- 生成PNG: `exec-d8dee93c-205f-48e1-acea-0dce3084ed3a.png`

```text
one rolled sage yoga mat with a broad simple spiral end, one rectangular tan cork block beside it, on a cream floor with a pale peach background. No plants, studio or person.
```

### キャンプ (`camping`)

- 配布画像: `camping.webp`
- 生成PNG: `exec-6422fdc3-68a4-4cce-b429-0c84a51fb22d.png`

```text
one simple sage triangular camping tent with a cream entrance and one small tan lantern in front, pale slate background and tan ground stripe. No forest, lake, campfire or mountain scenery.
```

### サウナ (`sauna`)

- 配布画像: `sauna.webp`
- 生成PNG: `exec-cf5201be-db13-44c1-8360-0e580dc07fad.png`

```text
one tan wooden sauna bucket with only two broad stave lines, a simple cream ladle resting over it, two broad pale steam curves; warm terracotta bench stripe and pale cream background. No stove or detailed room.
```

### カメラ・写真 (`camera`)

- 配布画像: `camera.webp`
- 生成PNG: `exec-b7b65539-7564-4693-ac6c-13ae94217860.png`

```text
one unbranded slate compact camera with a large dark circular lens and small cream highlights, simple tan strap curve, terracotta tabletop and cream background. No other props, realistic metal or lens reflections.
```

### ゲーム (`gaming`)

- 配布画像: `gaming.webp`
- 生成PNG: `exec-f1a310d3-6e68-427f-a6f1-ec527035e185.png`

```text
one unbranded sage game controller with two simple dark joysticks, one cream directional cross and four small terracotta button dots, tan ground stripe and pale blue background. No console, TV or screen.
```

### アニメ (`anime`)

- 配布画像: `anime.webp`
- 生成PNG: `exec-033e13a7-2cb5-4773-8d99-d1a66fa59e8f.png`

```text
one small sage television with a simple cream screen containing an original tiny rounded ochre fantasy creature on one pale blue ground stripe, simplified broad shapes, tan tabletop and cream wall. No known franchise, text, detailed story scene.
```

### 漫画 (`manga`)

- 配布画像: `manga.webp`
- 生成PNG: `exec-ce6a9238-5e4b-4e51-b05c-c203b7d5cf81.png`

```text
one open cream comic book with four broad dark rectangular panels containing only simple flat face silhouettes and one small speech oval without text; dark sage cover, tan tabletop and pale blue background. No fine line art or many books.
```

### ライブ・フェス (`live`)

- 配布画像: `live.webp`
- 生成PNG: `exec-18d9fdfc-2b0e-4fb8-93ef-7ad5e00d4386.png`

```text
one slate microphone on a short simple stand and one terracotta electric guitar, side by side against a muted pale blue background with just two broad warm spotlight circles. No stage rig, crowds, tiny lights or performers.
```

### カラオケ (`karaoke`)

- 配布画像: `karaoke.webp`
- 生成PNG: `exec-35d6c023-7145-4d71-975c-82e4dc1dd618.png`

```text
one slate handheld karaoke microphone with a broad rounded head, and one small sage remote controller with just three cream button marks, on a tan table against pale peach. No TV, booth or lettering.
```

### スイーツ (`sweets`)

- 配布画像: `sweets.webp`
- 生成PNG: `exec-ba24ab3c-9b32-412f-a484-c113c97b257f.png`

```text
one simple slice of strawberry cake, broad cream and terracotta layers and one strawberry on top, on a sage plate, pale cream background and tan tabletop. No many desserts, bakery or detailed frosting.
```

### 食べ歩き・グルメ (`food`)

- 配布画像: `food.webp`
- 生成PNG: `exec-fe424e1c-958c-4827-8639-496f820840a6.png`

```text
one cream ramen bowl with a warm terracotta rim, broad flat noodle curves, one simple egg half and two sage topping shapes, two tan chopsticks, pale blue background. No restaurant or many ingredients.
```

### 手芸・ハンドメイド (`craft`)

- 配布画像: `craft.webp`
- 生成PNG: `exec-0acd3686-c214-43a8-9598-574bdd361096.png`

```text
two simple sage and terracotta yarn balls with just three broad curved yarn lines each and two tan knitting needles, cream background and tan tabletop. No embroidery hoop, fabric textures or craft-room props.
```

### 買い物・ショッピング (`shopping`)

- 配布画像: `shopping.webp`
- 生成PNG: `exec-cf1d5dbd-dd25-400f-a8b2-6b158a0501af.png`

```text
two simple paper shopping bags in warm tan and sage, plain fronts and broad loop handles, centered on a terracotta ground stripe with a cream background. No brands, patterns, clothing store or extra shopping items.
```

### 美術・アート (`art`)

- 配布画像: `art.webp`
- 生成PNG: `exec-1fced236-5438-4272-a237-50f2c83bb603.png`

```text
one small cream artist palette with four broad painted color blobs in sage, terracotta, ochre and slate, two simple tan brushes resting diagonally over it, tan tabletop and pale blue background. No easel, room or detailed painting.
```

### ボードゲーム (`boardgame`)

- 配布画像: `boardgame.webp`
- 生成PNG: `exec-1899e4f7-a3f4-4fee-ae96-75936fadb2cb.png`

```text
one small sage rectangular board with only nine broad cream squares, three tan and terracotta playing pawns, one cream die with large dark dots. Tan tabletop and pale cream background. No text, cards or many scattered pieces.
```
