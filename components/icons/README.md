# Custom Icon Set

Minimal monotone SVG icon components used across the admin dashboard.

## Usage

```
import { AppIcon } from '@/components/icons'

<AppIcon name="records" size={20} className="text-gray-600" />
```

## Adding a New Icon
1. Open `components/icons/index.tsx`.
2. Create a component: `export const IconNewThing = (p:IconProps)=> (<IconBase {...p}>/* paths */</IconBase>)`.
3. Append it to the `icons` map: `newThing: IconNewThing`.
4. Use with `<AppIcon name="newThing" />`.

Icons follow:
- 24x24 viewBox
- Stroke width 1.5, rounded caps/joins
- No fills unless necessary
- Keep to 1–3 simple paths for clarity
