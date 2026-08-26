import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function packageRoot(name) {
  return realpathSync(join(projectRoot, "node_modules", ...name.split("/")));
}

function iosDependency(name, podspecFile, version) {
  const root = packageRoot(name);
  return {
    root,
    name,
    platforms: {
      ios: {
        podspecPath: join(root, podspecFile),
        version,
        configurations: [],
        scriptPhases: [],
      },
    },
  };
}

const reactNativePath = packageRoot("react-native");

const config = {
  root: projectRoot,
  reactNativePath,
  dependencies: {},
  project: {
    ios: {
      sourceDir: join(projectRoot, "ios"),
    },
  },
};

console.log(JSON.stringify(config));
