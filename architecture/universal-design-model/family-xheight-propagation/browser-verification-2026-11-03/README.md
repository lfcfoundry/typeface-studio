# Family x-height candidate browser verification

## Result

The two existing TTFs were inspected and served without rebuilding. Their internal reports describe seven glyphs each: .notdef, space, o, n, H, a, and h. All Unicode mappings and advances match. The records for .notdef, space, and H are identical. The outlines differ for o, n, a, and h, as expected for x-height propagation. Exact point changes and per-glyph counts are in results.json; complete parsed records are preserved in font-inventory.json.

Both original font files were served by the local server and returned HTTP 200 to Termux requests. Android Chrome did not request the review page or either font: the server log contains only the explicit Termux curl request. The Chrome launch intent returned success, but that alone does not establish that Chrome displayed the page. FontFace.load(), document.fonts.check(), JavaScript results, and visible rendering therefore remain unverified.

An Android screenshot was attempted with /system/bin/screencap; it failed with “Capturing failed.” No screenshot or browser-produced raster was captured. No synthetic replacement was made.

## Environment and exact font inputs

Device properties report Google Pixel 7 Pro, Android 17, SDK 37, Linux kernel 6.1.162-android14-11-g9dd05ae3a1de-ab16261587, aarch64. The installed com.android.chrome package has version code 807807904. The Chrome version name and browser user agent could not be obtained because the page did not execute.

Source revision: rev:9e756b95e08bc7de. Candidate revision: rev:96f4702797761a78. Source TTF SHA-256: 44aac2c744b2607037ce0445bdde7c1d9a2c1dd45e465d8e878f76c76e1f5efb. Candidate TTF SHA-256: 43310f5c97481f0c802d02f16e56ac29f5dba67c7aea3c0f9a4a5b3f9d0fdd8f. The source font has o/n/H/a/h advances 620/650/650/650/650; the candidate has the same advances. Candidate a has left bearing 37 versus 55 in the source; its right bearing remains 55. The internal audit records seven glyphs, UPM 1000, valid table checksums, and the U+0020/U+0048/U+0061/U+0068/U+006E/U+006F mappings. This is compiler-internal evidence, not independent validation.

## Review boundary

No subjective visual criterion could be assessed because no browser raster was captured. The candidate remains technically valid per the build report and internally audited, but it is not visually reviewed and is not visually approved.
