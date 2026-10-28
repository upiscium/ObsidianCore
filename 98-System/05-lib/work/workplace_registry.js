// User-owned configuration in normal Vault sync, outside Core-managed 98-System.
const REGISTRY_PATH = "97-Settings/workplaces.json";
const REGISTRY_FOLDER = "97-Settings";
const MAX_FILE_LENGTH = 65536;
const MAX_WORKPLACES = 200;

function emptyRegistry() {
  return { schema_version: 1, workplaces: [], default_workplace: null };
}

function normalizeName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || Array.from(name).length > 80 || /[\[\]\u0000-\u001f\u007f]/.test(name) || name === "未指定") {
    return null;
  }
  return name;
}

function nameKey(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
}

function findRegistered(state, name) {
  return state.workplaces.find(entry => nameKey(entry) === nameKey(name)) ?? null;
}

function parseRegistry(source) {
  if (typeof source !== "string" || source.length === 0 || source.length > MAX_FILE_LENGTH) {
    throw new Error("Workplace設定ファイルのサイズまたは内容が不正です。");
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Workplace設定ファイルがJSONとして読み取れません。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      parsed.schema_version !== 1 || !Array.isArray(parsed.workplaces) ||
      !Object.hasOwn(parsed, "default_workplace") ||
      Object.keys(parsed).some(key => !["schema_version", "workplaces", "default_workplace"].includes(key)) ||
      parsed.workplaces.length > MAX_WORKPLACES) {
    throw new Error("Workplace設定ファイルの形式が不正です。");
  }

  const workplaces = [];
  const keys = new Set();
  for (const value of parsed.workplaces) {
    const name = normalizeName(value);
    if (name === null || name !== value || keys.has(nameKey(name))) {
      throw new Error("Workplace設定ファイルに無効または重複した勤務先があります。");
    }
    keys.add(nameKey(name));
    workplaces.push(name);
  }

  const defaultName = parsed.default_workplace;
  if (defaultName !== null && (typeof defaultName !== "string" ||
      !workplaces.includes(defaultName))) {
    throw new Error("Workplace設定ファイルのデフォルト勤務先が登録一覧と一致しません。");
  }
  return { schema_version: 1, workplaces, default_workplace: defaultName };
}

function serializeRegistry(state) {
  return JSON.stringify(state, null, 2) + "\n";
}

function registryFile(vault) {
  const file = vault.getFileByPath?.(REGISTRY_PATH) ??
    vault.getAbstractFileByPath?.(REGISTRY_PATH) ?? null;
  if (file && (file.path !== REGISTRY_PATH || file.extension !== "json")) {
    throw new Error("Workplace設定の保存先が通常のJSONファイルではありません。");
  }
  return file;
}

async function readRegistry(app) {
  const file = registryFile(app.vault);
  return file ? parseRegistry(await app.vault.read(file)) : emptyRegistry();
}

async function updateRegistry(app, update) {
  const vault = app.vault;
  if (typeof vault.process !== "function" ||
      typeof vault.create !== "function" || typeof vault.createFolder !== "function") {
    throw new Error("Workplace設定にはObsidian Vault APIが必要です。");
  }
  let file = registryFile(vault);
  if (!file) {
    const planned = update(emptyRegistry());
    if (!planned.changed) return planned.result;
    if (!vault.getAbstractFileByPath?.(REGISTRY_FOLDER)) {
      try {
        await vault.createFolder(REGISTRY_FOLDER);
      } catch (error) {
        if (!vault.getAbstractFileByPath?.(REGISTRY_FOLDER)) throw error;
      }
    }
    try {
      await vault.create(REGISTRY_PATH, serializeRegistry(planned.state));
      return planned.result;
    } catch (error) {
      // A simultaneous first writer may have created it: re-evaluate on latest bytes.
      file = registryFile(vault);
      if (!file) throw error;
    }
  }

  let result;
  await vault.process(file, source => {
    const current = parseRegistry(source); // corrupt data is never overwritten
    const planned = update(current);
    result = planned.result;
    return planned.changed ? serializeRegistry(planned.state) : source;
  });
  return result;
}

async function registerWorkplace(app, rawName, makeDefault = false) {
  const name = normalizeName(rawName);
  if (name === null) throw new Error("勤務先名が不正です。");
  return updateRegistry(app, current => {
    const existing = findRegistered(current, name);
    const registered = existing ?? name;
    if (!existing && current.workplaces.length >= MAX_WORKPLACES) {
      throw new Error("登録可能な勤務先の上限を超えています。");
    }
    const next = {
      schema_version: 1,
      workplaces: existing ? current.workplaces : [...current.workplaces, name],
      default_workplace: makeDefault || current.workplaces.length === 0
        ? registered : current.default_workplace
    };
    return {
      state: next,
      changed: !existing || next.default_workplace !== current.default_workplace,
      result: { name: registered, created: !existing, default_workplace: next.default_workplace }
    };
  });
}

async function setDefaultWorkplace(app, rawName) {
  const name = rawName === null ? null : normalizeName(rawName);
  if (rawName !== null && name === null) throw new Error("勤務先名が不正です。");
  return updateRegistry(app, current => {
    const registered = name === null ? null : findRegistered(current, name);
    if (name !== null && registered === null) {
      throw new Error("デフォルト勤務先は登録済みの勤務先から選択してください。");
    }
    return {
      state: { ...current, default_workplace: registered },
      changed: current.default_workplace !== registered,
      result: { default_workplace: registered }
    };
  });
}

module.exports = {
  REGISTRY_PATH, emptyRegistry, normalizeName, parseRegistry,
  readRegistry, registerWorkplace, setDefaultWorkplace
};
