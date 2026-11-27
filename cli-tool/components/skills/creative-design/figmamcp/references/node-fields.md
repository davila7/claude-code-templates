# node_info fields

Generated from `@figma/plugin-typings` — the official Figma node field set. Pass any of these in `node_info`'s `fields`. (`id`, `name`, `type` are always returned.)

## Reference fields (resolved, not raw)

- **Node references** → returned as the target's `id` (or `id[]`), never a raw node: `parent`, `mainComponent`, `instances`, `exposedInstances`, `stuckNodes`, `attachedConnectors`.
- **Library references** → resolved to `{ id, name }`: `boundVariables` (recursively), `explicitVariableModes`, and the `*StyleId` fields.
- Other node-typed fields (`defaultVariant`, `stuckTo`, `text`, `textBackground`) are not returned raw.

## Data fields

| Field | Type |
|---|---|
| `absoluteBoundingBox` | `Rect \| null` |
| `absoluteRenderBounds` | `Rect \| null` |
| `absoluteTransform` | `Transform` |
| `annotations` | `readonly Annotation[]` |
| `arcData` | `ArcData` |
| `authorName` | `string` |
| `authorVisible` | `boolean` |
| `autoRename` | `boolean` |
| `backgroundStyleId` | `string` |
| `backgrounds` | `readonly Paint[]` |
| `blendMode` | `BlendMode` |
| `booleanOperation` | `"UNION" \| "INTERSECT" \| "SUBTRACT" \| "EXCLUDE"` |
| `bottomLeftRadius` | `number` |
| `bottomRightRadius` | `number` |
| `boundVariables` | `({ readonly visible?: VariableAlias \| undefined; readonly characters?: VariableAlias \| undefined; readonly height?: VariableAlias \| undefined; ... 22 more ...; readonly gridColumnGap?: VariableAlias \| undefined; } & { ...; } & { ...; }) \| undefined` |
| `characters` | `string` |
| `clipsContent` | `boolean` |
| `code` | `string` |
| `codeLanguage` | `"RUBY" \| "TYPESCRIPT" \| "CPP" \| "CSS" \| "JAVASCRIPT" \| "HTML" \| "JSON" \| "GRAPHQL" \| "PYTHON" \| "GO" \| "SQL" \| "SWIFT" \| "KOTLIN" \| "RUST" \| "BASH" \| "PLAINTEXT" \| "DART"` |
| `complexStrokeProperties` | `ComplexStrokeProperties` |
| `componentProperties` | `ComponentProperties` |
| `componentPropertyDefinitions` | `ComponentPropertyDefinitions` |
| `componentPropertyReferences` | `{ visible?: string \| undefined; characters?: string \| undefined; mainComponent?: string \| undefined; } \| null` |
| `connectorEnd` | `ConnectorEndpoint` |
| `connectorEndStrokeCap` | `ConnectorStrokeCap` |
| `connectorLineType` | `"ELBOWED" \| "STRAIGHT" \| "CURVED"` |
| `connectorStart` | `ConnectorEndpoint` |
| `connectorStartStrokeCap` | `ConnectorStrokeCap` |
| `constrainProportions` | `boolean` |
| `constraints` | `Constraints` |
| `cornerRadius` | `number \| unique symbol` |
| `cornerSmoothing` | `number` |
| `counterAxisAlignContent` | `"AUTO" \| "SPACE_BETWEEN"` |
| `counterAxisAlignItems` | `"MIN" \| "CENTER" \| "MAX" \| "BASELINE"` |
| `counterAxisSizingMode` | `"FIXED" \| "AUTO"` |
| `counterAxisSpacing` | `number \| null` |
| `dashPattern` | `readonly number[]` |
| `description` | `string` |
| `descriptionMarkdown` | `string` |
| `detachedInfo` | `DetachedInfo \| null` |
| `devStatus` | `DevStatus` |
| `documentationLinks` | `readonly DocumentationLink[]` |
| `effectStyleId` | `string` |
| `effects` | `readonly Effect[]` |
| `embedData` | `EmbedData` |
| `expanded` | `boolean` |
| `explicitVariableModes` | `{ [collectionId: string]: string; }` |
| `exportSettings` | `readonly ExportSettings[]` |
| `fillGeometry` | `VectorPaths` |
| `fillStyleId` | `string \| unique symbol` |
| `fills` | `readonly Paint[] \| unique symbol` |
| `fontName` | `unique symbol \| FontName` |
| `fontSize` | `number \| unique symbol` |
| `fontWeight` | `number \| unique symbol` |
| `gridChildHorizontalAlign` | `"MIN" \| "CENTER" \| "MAX" \| "AUTO"` |
| `gridChildVerticalAlign` | `"MIN" \| "CENTER" \| "MAX" \| "AUTO"` |
| `gridColumnAnchorIndex` | `number` |
| `gridColumnCount` | `number` |
| `gridColumnGap` | `number` |
| `gridColumnSizes` | `GridTrackSize[]` |
| `gridColumnSpan` | `number` |
| `gridRowAnchorIndex` | `number` |
| `gridRowCount` | `number` |
| `gridRowGap` | `number` |
| `gridRowSizes` | `GridTrackSize[]` |
| `gridRowSpan` | `number` |
| `gridStyleId` | `string` |
| `guides` | `readonly Guide[]` |
| `handleMirroring` | `unique symbol \| HandleMirroring` |
| `hangingList` | `boolean` |
| `hangingPunctuation` | `boolean` |
| `hasMissingFont` | `boolean` |
| `height` | `number` |
| `horizontalPadding` | `number` |
| `hyperlink` | `unique symbol \| HyperlinkTarget \| null` |
| `inferredAutoLayout` | `InferredAutoLayoutResult \| null` |
| `inferredVariables` | `({ readonly visible?: VariableAlias[] \| undefined; readonly characters?: VariableAlias[] \| undefined; readonly height?: VariableAlias[] \| undefined; ... 22 more ...; readonly gridColumnGap?: VariableAlias[] \| undefined; } & { ...; }) \| undefined` |
| `innerRadius` | `number` |
| `interactiveSlideElementType` | `"POLL" \| "EMBED" \| "FACEPILE" \| "ALIGNMENT" \| "YOUTUBE"` |
| `isAsset` | `boolean` |
| `isExposedInstance` | `boolean` |
| `isMask` | `boolean` |
| `isSkippedSlide` | `boolean` |
| `isWideWidth` | `boolean` |
| `itemReverseZIndex` | `boolean` |
| `itemSpacing` | `number` |
| `key` | `string` |
| `layoutAlign` | `"MIN" \| "CENTER" \| "MAX" \| "STRETCH" \| "INHERIT"` |
| `layoutGrids` | `readonly LayoutGrid[]` |
| `layoutGrow` | `number` |
| `layoutMode` | `"NONE" \| "HORIZONTAL" \| "VERTICAL" \| "GRID"` |
| `layoutPositioning` | `"AUTO" \| "ABSOLUTE"` |
| `layoutSizingHorizontal` | `"FIXED" \| "HUG" \| "FILL"` |
| `layoutSizingVertical` | `"FIXED" \| "HUG" \| "FILL"` |
| `layoutWrap` | `"NO_WRAP" \| "WRAP"` |
| `leadingTrim` | `unique symbol \| LeadingTrim` |
| `letterSpacing` | `unique symbol \| LetterSpacing` |
| `lineHeight` | `unique symbol \| LineHeight` |
| `linkUnfurlData` | `LinkUnfurlData` |
| `listSpacing` | `number` |
| `locked` | `boolean` |
| `maskType` | `MaskType` |
| `maxHeight` | `number \| null` |
| `maxLines` | `number \| null` |
| `maxWidth` | `number \| null` |
| `mediaData` | `MediaData` |
| `minHeight` | `number \| null` |
| `minWidth` | `number \| null` |
| `numColumns` | `number` |
| `numRows` | `number` |
| `numberOfFixedChildren` | `number` |
| `opacity` | `number` |
| `openTypeFeatures` | `unique symbol \| { readonly PCAP: boolean; readonly C2PC: boolean; readonly CASE: boolean; readonly CPSP: boolean; readonly TITL: boolean; readonly UNIC: boolean; readonly ZERO: boolean; ... 221 more ...; readonly CV99: boolean; }` |
| `overflowDirection` | `OverflowDirection` |
| `overlayBackground` | `OverlayBackground` |
| `overlayBackgroundInteraction` | `OverlayBackgroundInteraction` |
| `overlayPositionType` | `OverlayPositionType` |
| `overrides` | `{ id: string; overriddenFields: NodeChangeProperty[]; }[]` |
| `paddingBottom` | `number` |
| `paddingLeft` | `number` |
| `paddingRight` | `number` |
| `paddingTop` | `number` |
| `paragraphIndent` | `number` |
| `paragraphSpacing` | `number` |
| `pointCount` | `number` |
| `primaryAxisAlignItems` | `"MIN" \| "CENTER" \| "MAX" \| "SPACE_BETWEEN"` |
| `primaryAxisSizingMode` | `"FIXED" \| "AUTO"` |
| `reactions` | `readonly Reaction[]` |
| `relativeTransform` | `Transform` |
| `remote` | `boolean` |
| `removed` | `boolean` |
| `resolvedVariableModes` | `{ [collectionId: string]: string; }` |
| `rotation` | `number` |
| `scaleFactor` | `number` |
| `sectionContentsHidden` | `boolean` |
| `shapeType` | `"SQUARE" \| "ELLIPSE" \| "ROUNDED_RECTANGLE" \| "DIAMOND" \| "TRIANGLE_UP" \| "TRIANGLE_DOWN" \| "PARALLELOGRAM_RIGHT" \| "PARALLELOGRAM_LEFT" \| "ENG_DATABASE" \| "ENG_QUEUE" \| "ENG_FILE" \| ... 18 more ... \| "INTERNAL_STORAGE"` |
| `strokeAlign` | `"CENTER" \| "INSIDE" \| "OUTSIDE"` |
| `strokeBottomWeight` | `number` |
| `strokeCap` | `StrokeCap \| unique symbol` |
| `strokeGeometry` | `VectorPaths` |
| `strokeJoin` | `unique symbol \| StrokeJoin` |
| `strokeLeftWeight` | `number` |
| `strokeMiterLimit` | `number` |
| `strokeRightWeight` | `number` |
| `strokeStyleId` | `string` |
| `strokeTopWeight` | `number` |
| `strokeWeight` | `number \| unique symbol` |
| `strokes` | `readonly Paint[]` |
| `strokesIncludedInLayout` | `boolean` |
| `targetAspectRatio` | `Vector \| null` |
| `textAlignHorizontal` | `"CENTER" \| "LEFT" \| "RIGHT" \| "JUSTIFIED"` |
| `textAlignVertical` | `"CENTER" \| "TOP" \| "BOTTOM"` |
| `textAutoResize` | `"NONE" \| "WIDTH_AND_HEIGHT" \| "HEIGHT" \| "TRUNCATE"` |
| `textCase` | `unique symbol \| TextCase` |
| `textDecoration` | `unique symbol \| TextDecoration` |
| `textDecorationColor` | `unique symbol \| TextDecorationColor \| null` |
| `textDecorationOffset` | `unique symbol \| TextDecorationOffset \| null` |
| `textDecorationSkipInk` | `boolean \| unique symbol \| null` |
| `textDecorationStyle` | `unique symbol \| TextDecorationStyle \| null` |
| `textDecorationThickness` | `unique symbol \| TextDecorationThickness \| null` |
| `textPathStartData` | `TextPathStartData` |
| `textStyleId` | `string \| unique symbol` |
| `textTruncation` | `"DISABLED" \| "ENDING"` |
| `topLeftRadius` | `number` |
| `topRightRadius` | `number` |
| `transformModifiers` | `TransformModifier[]` |
| `variableWidthStrokeProperties` | `VariableWidthStrokeProperties \| null` |
| `variantGroupProperties` | `{ [property: string]: { values: string[]; }; }` |
| `variantProperties` | `{ [property: string]: string; } \| null` |
| `vectorNetwork` | `VectorNetwork` |
| `vectorPaths` | `VectorPaths` |
| `verticalPadding` | `number` |
| `visible` | `boolean` |
| `widgetId` | `string` |
| `widgetSyncedState` | `{ [key: string]: any; }` |
| `width` | `number` |
| `x` | `number` |
| `y` | `number` |
