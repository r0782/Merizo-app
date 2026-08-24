const fs = require("fs");
const path = require("path");
const { withDangerousMod, withMainApplication } = require("@expo/config-plugins");

const PACKAGE_PATH = "com/raghu30/merizo/speech";
const IMPORT_LINE = "import com.raghu30.merizo.speech.SpeechRecognizerPackage;";
const IMPORT_LINE_KT = "import com.raghu30.merizo.speech.SpeechRecognizerPackage";

// Copies the hand-written native module sources into the generated Android
// project on every `expo prebuild`, so the config plugin (not the generated
// android/ folder, which is gitignored) is the source of truth.
function withSpeechRecognizerSources(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const srcDir = path.join(config.modRequest.projectRoot, "plugins", "android-speech-native");
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        "app", "src", "main", "java", ...PACKAGE_PATH.split("/")
      );
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of fs.readdirSync(srcDir)) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      return config;
    },
  ]);
}

// Registers SpeechRecognizerPackage in MainApplication's getPackages() list.
// Expo SDK 54 generates a Kotlin MainApplication.kt by default, but this also
// handles a Java MainApplication.java for robustness across template versions.
function withSpeechRecognizerRegistration(config) {
  return withMainApplication(config, (config) => {
    const isKotlin = config.modResults.language === "kt";
    let contents = config.modResults.contents;

    const importLine = isKotlin ? IMPORT_LINE_KT : IMPORT_LINE;
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        /(package [^\n]+\n)/,
        `$1\n${importLine}\n`
      );
    }

    if (!contents.includes("SpeechRecognizerPackage(")) {
      if (isKotlin) {
        // SDK 54 template: `PackageList(this).packages.apply { ... }`
        if (/PackageList\(this\)\.packages\.apply\s*\{/.test(contents)) {
          contents = contents.replace(
            /(PackageList\(this\)\.packages\.apply\s*\{\n)/,
            `$1              add(SpeechRecognizerPackage())\n`
          );
        } else {
          // Older template: `val packages = PackageList(this).packages`
          contents = contents.replace(
            /(val packages = PackageList\(this\)\.packages\n)/,
            `$1          packages.add(SpeechRecognizerPackage())\n`
          );
        }
      } else {
        if (/new PackageList\(this\)\.getPackages\(\);/.test(contents)) {
          contents = contents.replace(
            /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);\n)/,
            `$1          packages.add(new SpeechRecognizerPackage());\n`
          );
        }
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = function withAndroidSpeechRecognizer(config) {
  config = withSpeechRecognizerSources(config);
  config = withSpeechRecognizerRegistration(config);
  return config;
};
