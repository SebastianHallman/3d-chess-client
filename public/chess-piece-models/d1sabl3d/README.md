# D1sabl3d piece set

Web versions of the user's Bonde, Torn, Springare, Lopare, Dam and Kung STL models.
Each GLB has approximately 12,000 triangles, smooth normals, a centered base,
and Y-up orientation. One board square corresponds to 57 mm in the originals.
Team colors are applied by the app.

Regenerate from the original STL directory with Blender:

```text
blender --background --python scripts/export-piece-set.py -- "PATH_TO_STL_DIRECTORY"
```

The export script only reads the source models. The original print files remain unchanged.
