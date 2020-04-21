#!/usr/bin/env node

const { program } = require("commander");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const homeDir = process.env.PWD;
const componentDir = `${homeDir}/src/components`;

program
  .option("-t, --template <template>", "What to copy")
  .option("-n, --name <name>", "What to call the component");

const flags = program.parse(process.argv);
const defaultName = flags.template ? flags.template : "Component";

const name = flags.name || defaultName;

const srcDir = flags.template
  ? `${componentDir}/${defaultName}`
  : `${__dirname}/${defaultName}`;

const getDirectories = src =>
  fsp
    .readdir(src, { withFileTypes: true })
    .then(dirs => dirs.filter(res => res.isDirectory()))
    .catch(e => {
      if (e.errno === -2) return [];
      throw e;
    });

const numberComponent = async name => {
  const nameMatch = new RegExp(`${name}(_[0-9]*)?$`, "g");

  const files = await getDirectories(componentDir);
  const allFiles = files
    .filter(file => file.name.match(nameMatch))
    .reduce((names, res) => `${names} ${res.name}`, "");

  if (!allFiles) return name;

  const matches = [...allFiles.matchAll(nameMatch)].sort();
  const last = matches.pop()[0];
  const lastNum = parseInt([...last.matchAll(/(?<=_)[0-9]*$/)]);
  const number = isNaN(lastNum) ? 1 : lastNum + 1;
  return `${name}_${number}`;
};

const mkDirs = (dir, name) =>
  fsp
    .mkdir(path.join(dir, name, "stories"), { recursive: true })
    .then(() => [path.join(dir, name), name])
    .catch(e => {
      throw Error(e);
    });

const generateFile = (file, name, match) =>
  fsp.readFile(file, "utf8").then(data => data.replace(match, name));

numberComponent(name).then(compName =>
  mkDirs(componentDir, compName).then(([dir, name]) => {
    const regex = new RegExp(defaultName, "g");
    const styleSrc = path.join(srcDir, "style.js");
    const styleDest = path.join(dir, "style.js");
    const indexSrc = path.join(srcDir, "index.js");
    const indexDest = path.join(dir, "index.js");
    const ComponentSrc = path.join(srcDir, `${defaultName}.js`);
    const ComponentDest = path.join(dir, `${name}.js`);
    const storiesSrc = path.join(
      srcDir,
      "stories",
      `${defaultName}.stories.js`
    );
    const storiesDest = path.join(dir, "stories", `${name}.stories.js`);

    const style = fsp.copyFile(styleSrc, styleDest);
    const index = generateFile(indexSrc, name, regex).then(data =>
      fsp.writeFile(indexDest, data, "utf8")
    );
    const component = generateFile(ComponentSrc, name, regex).then(data =>
      fsp.writeFile(ComponentDest, data, "utf8")
    );
    const story = generateFile(storiesSrc, name, regex).then(data =>
      fsp.writeFile(storiesDest, data, "utf8")
    );
    return Promise.all([style, index, component, story])
      .then(d => console.log("created new component: ", compName))
      .catch(e => {
        throw Error(e);
      });
  })
);
