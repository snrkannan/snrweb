const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, 'src/assets/fonts');
const manifestPath = path.join(fontsDir, 'font-manifest.json');

// Supported extensions
const extensions = ['.ttf', '.otf', '.woff', '.woff2'];

function generateManifest() {
    try {
        const files = fs.readdirSync(fontsDir);
        const assetFonts = files
            .filter(file => extensions.includes(path.extname(file).toLowerCase()))
            .map(file => {
                const nameWithoutExt = path.parse(file).name;
                // Prettify name: "school-cursive" -> "School Cursive"
                const friendlyName = nameWithoutExt
                    .split(/[-_]/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                return {
                    name: friendlyName,
                    file: file,
                    family: nameWithoutExt.replace(/[-_]/g, '') // Remove dashes for CSS family
                };
            });

        const manifest = { assetFonts };
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`✅ Font manifest generated with ${assetFonts.length} fonts!`);
    } catch (err) {
        console.error('❌ Error scanning fonts folder:', err);
    }
}

generateManifest();
const scssPath = path.join(__dirname, 'src/assets/fonts/_generated-fonts.scss');
let scssContent = '/* Auto-generated font-faces */\n';

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.assetFonts.forEach(f => {
    scssContent += `
@font-face {
  font-family: '${f.family}';
  src: url('./${f.file}'); /* FIXED: Pointing to current directory */
  font-display: swap;
}\n`;
});

fs.writeFileSync(scssPath, scssContent);