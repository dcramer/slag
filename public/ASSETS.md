# Third-party assets

Everything else in slag is procedural. The files below are small grayscale
"detail" maps derived from CC0 PBR materials. They are not used as-is: the
terrain painter (`src/render/terrain.ts`) colors them with each theme's
palette and uses them only to add surface detail and relief.

## Terrain detail textures (`public/textures/*.webp`)

Source: [ambientCG](https://ambientcg.com), by Lennart Demes. License: **CC0 1.0 Universal**
(public domain, no attribution required; credited here anyway).

How they're made: `npx tsx tools/textures.ts --cache <scratch dir>` downloads each
material's 1K-JPG zip, box-downsamples the Color, NormalGL and AmbientOcclusion
maps to 256 px wide (wrapping, so the tiles stay seamless), and packs two
grayscale halves into one 512×256 (or 512×128) WebP:

- left half: albedo detail (luminance × AO, high-passed, normalized around 0.5)
- right half: relief (normal map lit from the top-left; 0.5 = flat)

| File             | Used for (TerrainKind) | Source material | URL                                           | License | Size  |
| ---------------- | ---------------------- | --------------- | --------------------------------------------- | ------- | ----- |
| `rock.webp`      | rock                   | Rock030         | https://ambientcg.com/view?id=Rock030         | CC0     | 66 KB |
| `cave.webp`      | cave, crystal          | Rock035         | https://ambientcg.com/view?id=Rock035         | CC0     | 64 KB |
| `strata.webp`    | strata                 | Rock061         | https://ambientcg.com/view?id=Rock061         | CC0     | 50 KB |
| `basalt.webp`    | basalt                 | Rock058         | https://ambientcg.com/view?id=Rock058         | CC0     | 52 KB |
| `mossrock.webp`  | organic                | Rock064         | https://ambientcg.com/view?id=Rock064         | CC0     | 48 KB |
| `dirt.webp`      | dirt                   | Ground103       | https://ambientcg.com/view?id=Ground103       | CC0     | 58 KB |
| `forest.webp`    | loam                   | Ground037       | https://ambientcg.com/view?id=Ground037       | CC0     | 60 KB |
| `sand.webp`      | sand                   | Ground109       | https://ambientcg.com/view?id=Ground109       | CC0     | 51 KB |
| `brick.webp`     | brick                  | Bricks085       | https://ambientcg.com/view?id=Bricks085       | CC0     | 19 KB |
| `stone.webp`     | stone                  | Bricks111A      | https://ambientcg.com/view?id=Bricks111A      | CC0     | 42 KB |
| `cobble.webp`    | cobble                 | PavingStones119 | https://ambientcg.com/view?id=PavingStones119 | CC0     | 43 KB |
| `planks.webp`    | planks                 | Planks023A      | https://ambientcg.com/view?id=Planks023A      | CC0     | 34 KB |
| `metal.webp`     | metal                  | MetalPlates001  | https://ambientcg.com/view?id=MetalPlates001  | CC0     | 14 KB |
| `rustplate.webp` | rustplate              | MetalPlates011  | https://ambientcg.com/view?id=MetalPlates011  | CC0     | 36 KB |
| `concrete.webp`  | concrete               | Concrete031     | https://ambientcg.com/view?id=Concrete031     | CC0     | 40 KB |

Total: ~680 KB. Textures are optional at runtime: if one fails to load, the
terrain falls back to its procedural material.
