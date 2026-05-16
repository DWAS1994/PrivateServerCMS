# Theme assets

Drop your own image files into this folder to customize the look of your
panel. All slots are optional — if you don't supply a file, the theme falls
back to a CSS-only gold/burgundy gradient.

## The slots

| File path | Used by | Recommended size |
|---|---|---|
| `hero.jpg` | Homepage hero banner background | 1920×400 px, JPEG |
| `logo.png` | Optional logo override (replaces the gold seal in the nav) | 32×32 to 64×64 px, PNG with transparency |
| `class-warrior.png` | Warrior class icon | 64×64 PNG |
| `class-mage.png` | Mage class icon | 64×64 PNG |
| `class-rogue.png` | Rogue class icon | 64×64 PNG |
| `class-archer.png` | Archer class icon | 64×64 PNG |
| `class-cleric.png` | Cleric class icon | 64×64 PNG |
| `favicon.ico` | Browser tab icon | 32×32 .ico or .png |

## Adding more slots

If you want additional image slots — guild banners, race icons, event
artwork — add the CSS rule in `styles/globals.css` under the
"Custom-asset slots" section, then put the file here.

Example for a new "boss portrait" slot:

```css
.boss-portrait.crimson-dragon {
  background-image: url("/theme/boss-crimson-dragon.jpg");
}
```

## Important: licensing

The panel ships with **no copyrighted artwork**. You are responsible for
ensuring you have the right to use any images you place in this folder.
Game graphics from commercial MMOs are copyrighted by their publishers —
using them on a private server is at your own risk and is unrelated to your
license to use this CMS.
