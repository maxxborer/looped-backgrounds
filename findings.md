# Findings

- Local main branch and remote repository have no commits.
- Unconstrained random positions and multiple vertical speeds caused overlapping silhouettes.
- Tiny sprites reduced contour definition. A dot mask interrupted heart outlines.
- Revised particles use toroidal spacing, common translation and bounded local motion.
- Deliver SDR H.264 and separately graded HDR10 HEVC Main10 files. Device HDR playback requires a compatible display and player.
- All 720 geometry steps passed. Minimum conservative contour gaps: 32.49 px, 37.75 px and 34.45 px for the first three scenes.
- All five source scenes have identical pixel values at 0 and 12 seconds; ordinary and seam frame differences agree.
- Explicit zscale integer-to-float normalization avoids the default converter's white-level attenuation. The color pipeline produces 600.00 nits from the white control patch and 47.81 nits from code-128 gray.
- Actual decoded Ultraviolet HDR frame at 3 seconds: sampled peak 251.92 nits, frame average 3.36 nits.
- Browser SDR playback and local HTTP byte-range requests verified.
