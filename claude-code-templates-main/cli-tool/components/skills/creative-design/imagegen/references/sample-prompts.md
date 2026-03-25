# Sample prompts (copy/paste)

Use these as starting points (recipes only). Keep user-provided requirements; do not invent new creative elements.

For prompting principles (structure, invariants, iteration), see `references/prompting.md`.

## Generate

### photorealistic-natural
```
Use case: photorealistic-natural
Primary request: candid photo of an elderly sailor on a small fishing boat adjusting a net
Scene/background: coastal water with soft haze
Subject: weathered skin with wrinkles and sun texture; a calm dog on deck nearby
Style/medium: photorealistic candid photo
Composition/framing: medium close-up, eye-level, 50mm lens
Lighting/mood: soft coastal daylight, shallow depth of field, subtle film grain
Materials/textures: real skin texture, worn fabric, salt-worn wood
Constraints: natural color balance; no heavy retouching; no glamorization; no watermark
Avoid: studio polish; staged look
Quality: high
```

### product-mockup
```
Use case: product-mockup
Primary request: premium product photo of a matte black shampoo bottle with a minimal label
Scene/background: clean studio gradient from light gray to white
Subject: single bottle centered with subtle reflection
Style/medium: premium product photography
Composition/framing: centered, slight three-quarter angle, generous padding
Lighting/mood: softbox lighting, clean highlights, controlled shadows
Materials/textures: matte plastic, crisp label printing
Constraints: no logos or trademarks; no watermark
Quality: high
```

### ui-mockup
```
Use case: ui-mockup
Primary request: mobile app UI for a local farmers market with vendors and specials
Scene/background: clean white background with subtle natural accents
Subject: header, vendor list with small photos, "Today's specials" section, location and hours
Style/medium: realistic product UI, not concept art
Composition/framing: iPhone frame, balanced spacing and hierarchy
Constraints: practical layout, clear typography, no logos or trademarks, no watermark
```

### infographic-diagram
```
Use case: infographic-diagram
Primary request: detailed infographic of an automatic coffee machine flow
Scene/background: clean, light neutral background
Subject: bean hopper -> grinder -> brew group -> boiler -> water tank -> drip tray
Style/medium: clean vector-like infographic with clear callouts and arrows
Composition/framing: vertical poster layout, top-to-bottom flow
Text (verbatim): "Bean Hopper", "Grinder", "Brew Group", "Boiler", "Water Tank", "Drip Tray"
Constraints: clear labels, strong contrast, no logos or trademarks, no watermark
Quality: high
```

### logo-brand
```
Use case: logo-brand
Primary request: original logo for "Field & Flour", a local bakery
Style/medium: vector logo mark; flat colors; minimal
Composition/framing: single centered logo on plain background with padding
Constraints: strong silhouette, balanced negative space; original design only; no gradients unless essential; no trademarks; no watermark
```

### illustration-story
```
Use case: illustration-story
Primary request: 4-panel comic about a pet left alone at home
Scene/background: cozy living room across panels
Subject: pet reacting to the owner leaving, then relaxing, then returning to a composed pose
Style/medium: comic illustration with clear panels
Composition/framing: 4 equal-sized vertical panels, readable actions per panel
Constraints: no text; no logos or trademarks; no watermark
```

### stylized-concept
```
Use case: stylized-concept
Primary request: cavernous hangar interior with tall support beams and drifting fog
Scene/background: industrial hangar interior, deep scale, light haze
Subject: compact shuttle, parked center-left, bay door open
Style/medium: cinematic concept art, industrial realism
Composition/framing: wide-angle, low-angle, cinematic framing
Lighting/mood: volumetric light rays cutting through fog
Constraints: no logos or trademarks; no watermark
```

### historical-scene
```
Use case: historical-scene
Primary request: outdoor crowd scene in Bethel, New York on August 16, 1969
Scene/background: open field, temporary stages, period-accurate tents and signage
Subject: crowd in period-accurate clothing, authentic staging and environment
Style/medium: photorealistic photo
Composition/framing: wide shot, eye-level
Constraints: period-accurate details; no modern objects; no logos or trademarks; no watermark
```

## Asset type templates (taxonomy-aligned)

### Website assets template
```
Use case: <photorealistic-natural|stylized-concept|product-mockup|infographic-diagram|ui-mockup>
Asset type: <hero image / section illustration / blog header>
Primary request: <short description>
Scene/background: <environment or abstract background>
Subject: <main subject>
Style/medium: <photo/illustration/3D>
Composition/framing: <wide/centered; specify negative space side>
Lighting/mood: <soft/bright/neutral>
Color palette: <brand colors or neutral>
Constraints: <no text; no logos; no watermark; leave space for UI>
```

### Website assets example: minimal hero background
```
Use case: stylized-concept
Asset type: landing page hero background
Primary request: minimal abstract background with a soft gradient and subtle texture (calm, modern)
Style/medium: matte illustration / soft-rendered abstract background (not glossy 3D)
Composition/framing: wide composition; large negative space on the right for headline
Lighting/mood: gentle studio glow
Color palette: cool neutrals with a restrained blue accent
Constraints: no text; no logos; no watermark
```

### Website assets example: feature section illustration
```
Use case: stylized-concept
Asset type: feature section illustration
Primary request: simple abstract shapes suggesting connection and flow (tasteful, minimal)
Scene/background: subtle light-gray backdrop with faint texture
Style/medium: flat illustration; soft shadows; restrained contrast
Composition/framing: centered cluster; open margins for UI
Color palette: muted teal and slate, low contrast accents
Constraints: no text; no logos; no watermark
```

### Website assets example: blog header image
```
Use case: photorealistic-natural
Asset type: blog header image
Primary request: overhead desk scene with notebook, pen, and coffee cup
Scene/background: warm wooden tabletop
Style/medium: photorealistic photo
Composition/framing: wide crop; subject placed left; right side left empty
Lighting/mood: soft morning light
Constraints: no text; no logos; no watermark
```

### Game assets template
```
Use case: stylized-concept
Asset type: <game environment concept art / game character concept / game UI icon / tileable game texture>
Primary request: <biome/scene/character/icon/material>
Scene/background: <location + set dressing> (if applicable)
Subject: <main focal element(s)>
Style/medium: <realistic/stylized>; <concept art / character render / UI icon / texture>
Composition/framing: <wide/establishing/top-down>; <camera angle>; <focal point placement>
Lighting/mood: <time of day>; <mood>; <volumetric/fog/etc>
Constraints: no logos or trademarks; no watermark
```

### Game assets example: environment concept art
```
Use case: stylized-concept
Asset type: game environment concept art
Primary request: cavernous hangar interior with tall support beams and drifting fog
Scene/background: industrial hangar interior, deep scale, light haze
Subject: compact shuttle, parked center-left, bay door open
Foreground: painted floor markings; cables; tool carts along edges
Style/medium: cinematic concept art, industrial realism
Composition/framing: wide-angle, low-angle, cinematic framing
Lighting/mood: volumetric light rays cutting through fog
Constraints: no logos or trademarks; no watermark
```

### Game assets example: character concept
```
Use case: stylized-concept
Asset type: game character concept
Primary request: desert scout character with layered travel gear
Silhouette: long coat with hood, wide boots, satchel
Outfit/gear: dusty canvas, leather straps, brass buckles
Face/hair: windworn face, short cropped hair
Style/medium: character render; stylized realism
Pose: neutral hero pose
Background: simple neutral backdrop
Constraints: no logos or trademarks; no watermark
```

### Game assets example: UI icon
```
Use case: stylized-concept
Asset type: game UI icon
Primary request: round shield icon with a subtle rune pattern
Style/medium: painted game UI icon
Composition/framing: centered icon; generous padding; clear silhouette
Background: transparent
Lighting/mood: subtle highlights; crisp edges
Constraints: no text; no logos or trademarks; no watermark
```

### Game assets example: tileable texture
```
Use case: stylized-concept
Asset type: tileable game texture
Primary request: worn sandstone blocks
Style/medium: seamless tileable texture; PBR-ish look
Scale: medium tiling
Lighting: neutral / flat lighting
Constraints: seamless edges; no obvious focal elements; no text; no logos or trademarks; no watermark
```

### Wireframe template
```
Use case: ui-mockup
Asset type: website wireframe
Primary request: <page or flow to sketch>
Fidelity: low-fi grayscale wireframe; hand-drawn feel; simple boxes
Layout: <sections in order; grid/columns>
Annotations: <labels for key blocks>
Resolution/orientation: <landscape or portrait to match expected device>
Constraints: no color; no logos; no real photos; no watermark
```

### Wireframe example: homepage (desktop)
```
Use case: ui-mockup
Asset type: website wireframe
Primary request: SaaS homepage layout with clear hierarchy
Fidelity: low-fi grayscale wireframe; hand-drawn feel; simple boxes
Layout: top nav; hero with headline and CTA; three feature cards; testimonial strip; pricing preview; footer
Annotations: label each block ("Nav", "Hero", "CTA", "Feature", "Testimonial", "Pricing", "Footer")
Resolution/orientation: landscape (wide) for desktop
Constraints: no color; no logos; no real photos; no watermark
```

### Wireframe example: pricing page
```
Use case: ui-mockup
Asset type: website wireframe
Primary request: pricing page layout with comparison table
Fidelity: low-fi grayscale wireframe; sketchy lines; simple boxes
Layout: header; plan toggle; 3 pricing cards; comparison table; FAQ accordion; footer
Annotations: label key areas ("Toggle", "Plan Card", "Table", "FAQ")
Resolution/orientation: landscape for desktop or portrait for tablet
Constraints: no color; no logos; no real photos; no watermark
```

### Wireframe example: mobile onboarding flow
```
Use case: ui-mockup
Asset type: website wireframe
Primary request: three-screen mobile onboarding flow
Fidelity: low-fi grayscale wireframe; hand-drawn feel; simple boxes
Layout: screen 1 (logo placeholder, headline, illustration placeholder, CTA); screen 2 (feature bullets); screen 3 (form fields + CTA)
Annotations: label each block and screen number
Resolution/orientation: portrait (tall) for mobile
Constraints: no color; no logos; no real photos; no watermark
```

### Logo template
```
Use case: logo-brand
Asset type: logo concept
Primary request: <brand idea or symbol concept>
Style/medium: vector logo mark; flat colors; minimal
Composition/framing: centered mark; clear silhouette; generous margin
Color palette: <1-2 colors; high contrast>
Text (verbatim): "<exact name>" (only if needed)
Constraints: no gradients; no mockups; no 3D; no watermark
```

### Logo example: abstract symbol mark
```
Use case: logo-brand
Asset type: logo concept
Primary request: geometric leaf symbol suggesting sustainability and growth
Style/medium: vector logo mark; flat colors; minimal
Composition/framing: centered mark; clear silhouette
Color palette: deep green and off-white
Constraints: no text; no gradients; no mockups; no 3D; no watermark
```

### Logo example: monogram mark
```
Use case: logo-brand
Asset type: logo concept
Primary request: interlocking monogram of the letters "AV"
Style/medium: vector logo mark; flat colors; minimal
Composition/framing: centered mark; balanced spacing
Color palette: black on white
Constraints: no gradients; no mockups; no 3D; no watermark
```

### Logo example: wordmark
```
Use case: logo-brand
Asset type: logo concept
Primary request: clean wordmark for a modern studio
Style/medium: vector wordmark; flat colors; minimal
Text (verbatim): "Studio North"
Composition/framing: centered text; even letter spacing
Color palette: charcoal on white
Constraints: no gradients; no mockups; no 3D; no watermark
```

## Edit

### text-localization
```
Use case: text-localization
Input images: Image 1: original infographic
Primary request: translate all in-image text to Spanish
Constraints: change only the text; preserve layout, typography, spacing, and hierarchy; no extra words; do not alter logos or imagery
```

### identity-preserve
```
Use case: identity-preserve
Input images: Image 1: person photo; Image 2..N: clothing items
Primary request: replace only the clothing with the provided garments
Constraints: preserve face, body shape, pose, hair, expression, and identity; match lighting and shadows; keep background unchanged; no accessories or text
Input fidelity (edits): high
```

### precise-object-edit
```
Use case: precise-object-edit
Input images: Image 1: room photo
Primary request: replace ONLY the white chairs with wooden chairs
Constraints: preserve camera angle, room lighting, floor shadows, and surrounding objects; keep all other aspects unchanged
```

### lighting-weather
```
Use case: lighting-weather
Input images: Image 1: original photo
Primary request: make it look like a winter evening with gentle snowfall
Constraints: preserve subject identity, geometry, camera angle, and composition; change only lighting, atmosphere, and weather
Quality: high
```

### background-extraction
```
Use case: background-extraction
Input images: Image 1: product photo
Primary request: extract the product on a transparent background
Output: transparent background (RGBA PNG)
Constraints: crisp silhouette, no halos/fringing; preserve label text exactly; no restyling
```

### style-transfer
```
Use case: style-transfer
Input images: Image 1: style reference
Primary request: apply Image 1's visual style to a man riding a motorcycle on a white background
Constraints: preserve palette, texture, and brushwork; no extra elements; plain white background
```

### compositing
```
Use case: compositing
Input images: Image 1: base scene; Image 2: subject to insert
Primary request: place the subject from Image 2 next to the person in Image 1
Constraints: match lighting, perspective, and scale; keep background and framing unchanged; no extra elements
Input fidelity (edits): high
```

### sketch-to-render
```
Use case: sketch-to-render
Input images: Image 1: drawing
Primary request: turn the drawing into a photorealistic image
Constraints: preserve layout, proportions, and perspective; choose realistic materials and lighting; do not add new elements or text
Quality: high
```
