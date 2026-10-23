// Signs release builds with our own keystore when CI provides one through env vars.
// Without the env vars (local builds) it falls back to the debug key, like the default template.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (System.getenv('CKAGRAM_KEYSTORE')) {
                storeFile file(System.getenv('CKAGRAM_KEYSTORE'))
                storePassword System.getenv('CKAGRAM_KEYSTORE_PASSWORD')
                keyAlias System.getenv('CKAGRAM_KEY_ALIAS')
                keyPassword System.getenv('CKAGRAM_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('CKAGRAM_KEYSTORE')) return cfg;

    const signingBlock = /signingConfigs\s*\{/;
    const releaseUsesDebug = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!signingBlock.test(gradle) || !releaseUsesDebug.test(gradle)) {
      throw new Error('withReleaseSigning: android/app/build.gradle layout changed; update the plugin.');
    }

    gradle = gradle.replace(signingBlock, (m) => m + RELEASE_SIGNING);
    gradle = gradle.replace(
      releaseUsesDebug,
      "$1signingConfig System.getenv('CKAGRAM_KEYSTORE') ? signingConfigs.release : signingConfigs.debug"
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
