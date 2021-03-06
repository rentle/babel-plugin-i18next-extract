import i18next from 'i18next';
import { isFile } from '@babel/types';
import path, { resolve, isAbsolute, relative, dirname, sep } from 'path';
import fs from 'fs';
import stringify from 'json-stable-stringify';

/**
 * Comment Hint without line location information.
 */

/**
 * Line intervals
 */

/**
 * Comment Hint with line intervals information.
 */
const COMMENT_HINT_PREFIX = 'i18next-extract-';
const COMMENT_HINTS_KEYWORDS = {
  DISABLE: {
    LINE: COMMENT_HINT_PREFIX + 'disable-line',
    NEXT_LINE: COMMENT_HINT_PREFIX + 'disable-next-line',
    SECTION_START: COMMENT_HINT_PREFIX + 'disable',
    SECTION_STOP: COMMENT_HINT_PREFIX + 'enable'
  },
  NAMESPACE: {
    LINE: COMMENT_HINT_PREFIX + 'mark-ns-line',
    NEXT_LINE: COMMENT_HINT_PREFIX + 'mark-ns-next-line',
    SECTION_START: COMMENT_HINT_PREFIX + 'mark-ns-start',
    SECTION_STOP: COMMENT_HINT_PREFIX + 'mark-ns-stop'
  },
  CONTEXT: {
    LINE: COMMENT_HINT_PREFIX + 'mark-context-line',
    NEXT_LINE: COMMENT_HINT_PREFIX + 'mark-context-next-line',
    SECTION_START: COMMENT_HINT_PREFIX + 'mark-context-start',
    SECTION_STOP: COMMENT_HINT_PREFIX + 'mark-context-stop'
  },
  PLURAL: {
    LINE: COMMENT_HINT_PREFIX + 'mark-plural-line',
    NEXT_LINE: COMMENT_HINT_PREFIX + 'mark-plural-next-line',
    SECTION_START: COMMENT_HINT_PREFIX + 'mark-plural-start',
    SECTION_STOP: COMMENT_HINT_PREFIX + 'mark-plural-stop'
  }
};
/**
 * Given a Babel Comment, extract BaseCommentHints.
 * @param comment babel comment
 * @yields Comment hint without line interval information.
 */

function* extractCommentHintsFromBabelComment(comment) {
  for (const line of comment.value.split(/\r?\n/)) {
    const trimmedValue = line.trim();
    const keyword = trimmedValue.split(/\s+/)[0];
    const value = trimmedValue.split(/\s+(.+)/)[1] || '';

    for (const [commentHintType, commentHintKeywords] of Object.entries(COMMENT_HINTS_KEYWORDS)) {
      for (const [commentHintScope, commentHintKeyword] of Object.entries(commentHintKeywords)) {
        if (keyword === commentHintKeyword) {
          yield {
            type: commentHintType,
            scope: commentHintScope,
            value,
            comment
          };
        }
      }
    }
  }
}
/**
 * Given an array of comment hints, compute their intervals.
 * @param commentHints comment hints without line intervals information.
 * @returns Comment hints with line interval information.
 */


function computeCommentHintsIntervals(commentHints) {
  const result = Array();

  for (const commentHint of commentHints) {
    if (commentHint.scope === 'LINE') {
      result.push({
        startLine: commentHint.comment.loc.start.line,
        stopLine: commentHint.comment.loc.start.line,
        ...commentHint
      });
    }

    if (commentHint.scope === 'NEXT_LINE') {
      result.push({
        startLine: commentHint.comment.loc.end.line + 1,
        stopLine: commentHint.comment.loc.end.line + 1,
        ...commentHint
      });
    }

    if (commentHint.scope === 'SECTION_START') {
      result.push({
        startLine: commentHint.comment.loc.start.line,
        stopLine: Infinity,
        ...commentHint
      });
    }

    if (commentHint.scope === 'SECTION_STOP') {
      for (const res of result) {
        if (res.type === commentHint.type && res.scope === 'SECTION_START' && res.stopLine === Infinity) {
          res.stopLine = commentHint.comment.loc.start.line;
        }
      }
    }
  }

  return result;
}
/**
 * Given Babel comments, extract the comment hints.
 * @param comments Babel comments (ordered by line)
 */


function parseCommentHints(comments) {
  const baseCommentHints = Array();

  for (const comment of comments) {
    baseCommentHints.push(...extractCommentHintsFromBabelComment(comment));
  }

  return computeCommentHintsIntervals(baseCommentHints);
}
/**
 * Find comment hint of a given type that applies to a Babel node path.
 * @param path babel node path
 * @param commentHintType Type of comment hint to look for.
 * @param commentHints All the comment hints, as returned by parseCommentHints function.
 */

function getCommentHintForPath(path, commentHintType, commentHints) {
  if (!path.node.loc) return null;
  const nodeLine = path.node.loc.start.line;

  for (const commentHint of commentHints) {
    if (commentHint.type === commentHintType && commentHint.startLine <= nodeLine && nodeLine <= commentHint.stopLine) {
      return commentHint;
    }
  }

  return null;
}

function resolveIfRelative(path) {
  if (path.startsWith('.')) {
    return resolve(path);
  }

  return path;
}

function coalesce(v, defaultVal) {
  return v === undefined ? defaultVal : v;
}
/**
 * Given Babel options, return an initialized Config object.
 *
 * @param opts plugin options given by Babel
 */


function parseConfig(opts) {
  const defaultLocales = ['en'];
  const customTransComponents = coalesce(opts.customTransComponents, []);
  const customUseTranslationHooks = coalesce(opts.customUseTranslationHooks, []);
  return {
    locales: coalesce(opts.locales, defaultLocales),
    defaultNS: coalesce(opts.defaultNS, 'translation'),
    pluralSeparator: coalesce(opts.pluralSeparator, '_'),
    contextSeparator: coalesce(opts.contextSeparator, '_'),
    keySeparator: coalesce(opts.keySeparator, '.'),
    nsSeparator: coalesce(opts.nsSeparator, ':'),
    // From react-i18next: https://github.com/i18next/react-i18next/blob/90f0e44ac2710ae422f1e8b0270de95fedc6429c/react-i18next.js#L334
    transKeepBasicHtmlNodesFor: coalesce(opts.transKeepBasicHtmlNodesFor, ['br', 'strong', 'i', 'p']),
    i18nextInstanceNames: coalesce(opts.i18nextInstanceNames, ['i18next', 'i18n']),
    tFunctionNames: coalesce(opts.tFunctionNames, ['t']),
    defaultContexts: coalesce(opts.defaultContexts, ['', 'male', 'female']),
    outputPath: coalesce(opts.outputPath, './extractedTranslations/{{locale}}/{{ns}}.json'),
    defaultValue: coalesce(opts.defaultValue, ''),
    useI18nextDefaultValue: coalesce(opts.useI18nextDefaultValue, defaultLocales),
    useI18nextDefaultValueForDerivedKeys: coalesce(opts.useI18nextDefaultValueForDerivedKeys, false),
    keyAsDefaultValue: coalesce(opts.keyAsDefaultValue, false),
    keyAsDefaultValueForDerivedKeys: coalesce(opts.keyAsDefaultValueForDerivedKeys, true),
    discardOldKeys: coalesce(opts.discardOldKeys, false),
    jsonSpace: coalesce(opts.jsonSpace, 2),
    enableExperimentalIcu: coalesce(opts.enableExperimentalIcu, false),
    customTransComponents,
    customUseTranslationHooks,
    cache: {
      absoluteCustomTransComponents: customTransComponents.map(([sourceModule, importName]) => [resolveIfRelative(sourceModule), importName]),
      absoluteCustomHooks: customUseTranslationHooks.map(([sourceModule, importName]) => [resolveIfRelative(sourceModule), importName])
    }
  };
}

const PLUGIN_NAME = 'babel-plugin-i18next-extract';

/**
 * Generic class thrown by exporters in case of error.
 */
class ExportError extends Error {}
/**
 * Thrown by exporters when an existing value in a translation
 * file is incompatible with the value we're trying to set.
 *
 * For instance, if the translation file contains a deep key named `foo.bar`
 * but we extracted a (not deep) `foo` key, this error may be thrown.
 */

class ConflictError extends ExportError {}
/**
 * Interface implented by exporters.
 */

/**
 * JSONv3 values can be any valid value for JSON file.
 *
 * See i18next's "returnObjects" option.
 */

/**
 * Check whether a JsonV3Value is a plain object.
 */
function jsonV3ValueIsObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}
/**
 * Add a key recursively to a JSONv3 file.
 *
 * @param fileContent JSONv3 file content
 * @param keyPath keyPath of the key to add
 * @param cleanKey key without path
 * @param value Value to set for the key.
 */


function recursiveAddKey(fileContent, keyPath, cleanKey, value) {
  if (keyPath.length === 0) {
    return { ...fileContent,
      [cleanKey]: value
    };
  }

  const currentKeyPath = keyPath[0];
  let current = fileContent[currentKeyPath];

  if (current === undefined) {
    current = {};
  } else if (!jsonV3ValueIsObject(current)) {
    throw new ConflictError();
  }

  return { ...fileContent,
    [currentKeyPath]: recursiveAddKey(current, keyPath.slice(1), cleanKey, value)
  };
}

const jsonv3Exporter = {
  init: () => {
    return {
      whitespacesBefore: '',
      whitespacesAfter: '\n',
      content: {}
    };
  },
  parse: ({
    content
  }) => {
    const whitespacesBeforeMatch = content.match(/^(\s*)/);
    const whitespacesAfterMatch = content.match(/(\s*)$/);
    return {
      whitespacesBefore: whitespacesBeforeMatch === null ? '' : whitespacesBeforeMatch[0],
      whitespacesAfter: whitespacesAfterMatch === null ? '' : whitespacesAfterMatch[0],
      content: JSON.parse(content)
    };
  },
  stringify: ({
    config,
    file
  }) => {
    return file.whitespacesBefore + stringify(file.content, {
      space: config.jsonSpace
    }) + file.whitespacesAfter;
  },
  getKey: ({
    file,
    keyPath,
    cleanKey
  }) => {
    let current = file.content;

    for (const p of keyPath) {
      const val = current[p];

      if (val === undefined) {
        return undefined;
      } else if (!jsonV3ValueIsObject(val)) {
        throw new ConflictError();
      }

      current = val;
    }

    return current[cleanKey];
  },
  addKey: params => {
    const {
      key,
      file,
      value
    } = params;
    return { ...file,
      content: recursiveAddKey(file.content, key.keyPath, key.cleanKey, value)
    };
  }
};

/**
 * An instance of exporter cache.
 *
 * See createExporterCache for details.
 */

/**
 * This creates a new empty cache for the exporter.
 *
 * The cache is required by the exporter and is used to merge the translations
 * from the original translation file. It will be  mutated by the exporter
 * and the same instance must be given untouched across export calls.
 */
function createExporterCache() {
  return {
    originalTranslationFiles: {},
    currentTranslationFiles: {}
  };
}
/**
 * Load a translation file.
 */

function loadTranslationFile( // eslint-disable-next-line @typescript-eslint/no-explicit-any
exporter, config, filePath) {
  let content;

  try {
    content = fs.readFileSync(filePath, {
      encoding: 'utf8'
    });
  } catch (err) {
    if (err.code === 'ENOENT') return exporter.init({
      config
    });
    throw err;
  }

  return exporter.parse({
    config,
    content
  });
}
/**
 * Get the default value for a key.
 */


function getDefaultValue(key, locale, config) {
  let defaultValue = config.defaultValue;
  const keyAsDefaultValueEnabled = config.keyAsDefaultValue === true || Array.isArray(config.keyAsDefaultValue) && config.keyAsDefaultValue.includes(locale);
  const keyAsDefaultValueForDerivedKeys = config.keyAsDefaultValueForDerivedKeys;

  if (keyAsDefaultValueEnabled && (keyAsDefaultValueForDerivedKeys || !key.isDerivedKey)) {
    defaultValue = key.cleanKey;
  }

  const useI18nextDefaultValueEnabled = config.useI18nextDefaultValue === true || Array.isArray(config.useI18nextDefaultValue) && config.useI18nextDefaultValue.includes(locale);
  const useI18nextDefaultValueForDerivedKeys = config.useI18nextDefaultValueForDerivedKeys;

  if (useI18nextDefaultValueEnabled && key.parsedOptions.defaultValue !== null && (useI18nextDefaultValueForDerivedKeys || !key.isDerivedKey)) {
    defaultValue = key.parsedOptions.defaultValue;
  }

  return defaultValue;
}
/**
 * Exports all given translation keys as JSON.
 *
 * @param keys: translation keys to export
 * @param locale: the locale to export
 * @param config: plugin configuration
 * @param cache: cache instance to use (see createExporterCache)
 */


function exportTranslationKeys(keys, locale, config, cache) {
  const keysPerFilepath = {};
  const exporter = jsonv3Exporter;

  for (const key of keys) {
    // Figure out in which path each key should go.
    const filePath = config.outputPath.replace('{{locale}}', locale).replace('{{ns}}', key.ns);
    keysPerFilepath[filePath] = [...(keysPerFilepath[filePath] || []), key];
  }

  for (const [filePath, keysForFilepath] of Object.entries(keysPerFilepath)) {
    if (!(filePath in cache.originalTranslationFiles)) {
      // Cache original translation file so that we don't loose it across babel
      // passes.
      cache.originalTranslationFiles[filePath] = loadTranslationFile(exporter, config, filePath);
    }

    const originalTranslationFile = cache.originalTranslationFiles[filePath];
    let translationFile = cache.currentTranslationFiles[filePath] || (config.discardOldKeys ? exporter.init({
      config
    }) : originalTranslationFile);

    for (const k of keysForFilepath) {
      const previousValue = exporter.getKey({
        config,
        file: originalTranslationFile,
        keyPath: k.keyPath,
        cleanKey: k.cleanKey
      });
      translationFile = exporter.addKey({
        config,
        file: translationFile,
        key: k,
        value: previousValue === undefined ? getDefaultValue(k, locale, config) : previousValue
      });
    }

    cache.currentTranslationFiles[filePath] = translationFile;
    cache.originalTranslationFiles[filePath] = translationFile; // Finally do the export

    const directoryPath = path.dirname(filePath);
    fs.mkdirSync(directoryPath, {
      recursive: true
    });
    fs.writeFileSync(filePath, exporter.stringify({
      config,
      file: translationFile
    }), {
      encoding: 'utf8'
    });
  }
}

/**
 * Error thrown in case extraction of a node failed.
 */
class ExtractionError extends Error {
  constructor(message, node) {
    super(message);
    this.nodePath = node;
  }

}
/**
 * Given a value, if the value is an array, return the first
 * item of the array. Otherwise, return the value.
 *
 * This is mainly useful to parse namespaces which can be strings
 * as well as array of strings.
 */

function getFirstOrNull(val) {
  if (Array.isArray(val)) val = val[0];
  return val === undefined ? null : val;
}
/**
 * Given comment hints and a path, infer every I18NextOption we can from the comment hints.
 * @param path path on which the comment hints should apply
 * @param commentHints parsed comment hints
 * @returns every parsed option that could be infered.
 */

function parseI18NextOptionsFromCommentHints(path, commentHints) {
  const nsCommentHint = getCommentHintForPath(path, 'NAMESPACE', commentHints);
  const contextCommentHint = getCommentHintForPath(path, 'CONTEXT', commentHints);
  const pluralCommentHint = getCommentHintForPath(path, 'PLURAL', commentHints);
  const res = {};

  if (nsCommentHint !== null) {
    res.ns = nsCommentHint.value;
  }

  if (contextCommentHint !== null) {
    if (['', 'enable'].includes(contextCommentHint.value)) {
      res.contexts = true;
    } else if (contextCommentHint.value === 'disable') {
      res.contexts = false;
    } else {
      try {
        const val = JSON.parse(contextCommentHint.value);
        if (Array.isArray(val)) res.contexts = val;else res.contexts = [contextCommentHint.value];
      } catch (err) {
        res.contexts = [contextCommentHint.value];
      }
    }
  }

  if (pluralCommentHint !== null) {
    if (pluralCommentHint.value === 'disable') {
      res.hasCount = false;
    } else {
      res.hasCount = true;
    }
  }

  return res;
}
/**
 * Improved version of BabelCore `referencesImport` function that also tries to detect wildcard
 * imports.
 */

function referencesImport(nodePath, moduleSource, importName) {
  if (nodePath.referencesImport(moduleSource, importName)) return true;

  if (nodePath.isMemberExpression() || nodePath.isJSXMemberExpression()) {
    const obj = nodePath.get('object');
    const prop = nodePath.get('property');
    if (Array.isArray(obj) || Array.isArray(prop) || !prop.isIdentifier() && !prop.isJSXIdentifier()) return false;
    return obj.referencesImport(moduleSource, '*') && prop.node.name === importName;
  }

  return false;
}
/**
 * Whether a class-instance function call expression matches a known method
 * @param nodePath: node path to evaluate
 * @param parentNames: list for any class-instance names to match
 * @param childName specific function from parent module to match
 */

function referencesChildIdentifier(nodePath, parentNames, childName) {
  if (!nodePath.isMemberExpression()) return false;
  const obj = nodePath.get('object');
  if (!obj.isIdentifier()) return false;
  const prop = nodePath.get('property');
  if (Array.isArray(prop) || !prop.isIdentifier()) return false;
  return parentNames.includes(obj.node.name) && prop.node.name === childName;
}
/**
 * Evaluates a node path if it can be evaluated with confidence.
 *
 * @param path: node path to evaluate
 * @returns null if the node path couldn't be evaluated
 */

function evaluateIfConfident( // eslint-disable-next-line @typescript-eslint/no-explicit-any
path) {
  if (!path || !path.node) {
    return null;
  }

  const evaluation = path.evaluate();

  if (evaluation.confident) {
    return evaluation.value;
  }

  return null;
}
/**
 * Generator that iterates on all keys in an object expression.
 * @param path the node path of the object expression
 * @param key the key to find in the object expression.
 * @yields [evaluated key, node path of the object expression property]
 */

function* iterateObjectExpression(path) {
  const properties = path.get('properties');

  for (const prop of properties) {
    const keyPath = prop.get('key');
    if (Array.isArray(keyPath)) continue;
    let keyEvaluation = null;

    if (keyPath.isLiteral()) {
      keyEvaluation = evaluateIfConfident(keyPath);
    } else if (keyPath.isIdentifier()) {
      keyEvaluation = keyPath.node.name;
    } else {
      continue;
    }

    yield [keyEvaluation, prop];
  }
}
/**
 * Try to find a key in an object expression.
 * @param path the node path of the object expression
 * @param key the key to find in the object expression.
 * @returns the corresponding node or null if it wasn't found
 */

function findKeyInObjectExpression(path, key) {
  for (const [keyEvaluation, prop] of iterateObjectExpression(path)) {
    if (keyEvaluation === key) return prop;
  }

  return null;
}
/**
 * Find a JSX attribute given its name.
 * @param path path of the jsx attribute
 * @param name name of the attribute to look for
 * @return The JSX attribute corresponding to the given name, or null if no
 *   attribute with this name could be found.
 */

function findJSXAttributeByName(path, name) {
  const openingElement = path.get('openingElement');
  const attributes = openingElement.get('attributes');

  for (const attribute of attributes) {
    if (!attribute.isJSXAttribute()) continue;
    const attributeName = attribute.get('name');
    if (!attributeName.isJSXIdentifier()) continue;
    if (name === attributeName.node.name) return attribute;
  }

  return null;
}
/**
 * Attempt to find the latest assigned value for a given identifier.
 *
 * For instance, given the following code:
 *   const foo = 'bar';
 *   console.log(foo);
 *
 * resolveIdentifier(fooNodePath) should return the 'bar' literal.
 *
 * Obviously, this will only work in quite simple cases.
 *
 * @param nodePath: node path to resolve
 * @return the resolved expression or null if it could not be resolved.
 */

function resolveIdentifier(nodePath) {
  const bindings = nodePath.scope.bindings[nodePath.node.name];
  if (!bindings) return null;
  const declarationExpressions = [...(bindings.path.isVariableDeclarator() ? [bindings.path.get('init')] : []), ...bindings.constantViolations.filter(p => p.isAssignmentExpression()).map(p => p.get('right'))];
  if (declarationExpressions.length === 0) return null;
  const latestDeclarator = declarationExpressions[declarationExpressions.length - 1];
  if (Array.isArray(latestDeclarator)) return null;
  if (!latestDeclarator.isExpression()) return null;
  return latestDeclarator;
}
/**
 * Check whether a given node is a custom import.
 *
 * @param absoluteNodePaths: list of possible custom nodes, with their source
 *   modules and import names.
 * @param path: node path to check
 * @param name: node name to check
 * @returns true if the given node is a match.
 */

function isCustomImportedNode(absoluteNodePaths, path, name) {
  return absoluteNodePaths.some(([sourceModule, importName]) => {
    if (isAbsolute(sourceModule)) {
      let relativeSourceModulePath = relative(dirname(path.state.filename), sourceModule);

      if (!relativeSourceModulePath.startsWith('.')) {
        relativeSourceModulePath = '.' + sep + relativeSourceModulePath;
      } // Absolute path to the source module, let's try a relative path first.


      if (referencesImport(name, relativeSourceModulePath, importName)) {
        return true;
      }
    }

    return referencesImport(name, sourceModule, importName);
  });
}

/**
 * Check whether a given JSXElement is a Trans component.
 * @param path: node path to check
 * @returns true if the given element is indeed a `Trans` component.
 */

function isTransComponent(path) {
  const openingElement = path.get('openingElement');
  return referencesImport(openingElement.get('name'), 'react-i18next', 'Trans');
}
/**
 * Given a Trans component, extract its options.
 * @param path The node path of the JSX Element of the trans component
 * @param commentHints Parsed comment hints.
 * @returns The parsed i18next options
 */


function parseTransComponentOptions(path, commentHints) {
  const res = {
    contexts: false,
    hasCount: false,
    ns: null,
    defaultValue: null
  };
  const countAttr = findJSXAttributeByName(path, 'count');
  res.hasCount = countAttr !== null;
  const tOptionsAttr = findJSXAttributeByName(path, 'tOptions');

  if (tOptionsAttr) {
    const value = tOptionsAttr.get('value');

    if (value.isJSXExpressionContainer()) {
      const expression = value.get('expression');

      if (expression.isObjectExpression()) {
        res.contexts = findKeyInObjectExpression(expression, 'context') !== null;
      }
    }
  }

  const nsAttr = findJSXAttributeByName(path, 'ns');

  if (nsAttr) {
    let value = nsAttr.get('value');
    if (value.isJSXExpressionContainer()) value = value.get('expression');
    res.ns = getFirstOrNull(evaluateIfConfident(value));
  }

  const defaultsAttr = findJSXAttributeByName(path, 'defaults');

  if (defaultsAttr) {
    let value = defaultsAttr.get('value');
    if (value.isJSXExpressionContainer()) value = value.get('expression');
    res.defaultValue = evaluateIfConfident(value);
  }

  return { ...res,
    ...parseI18NextOptionsFromCommentHints(path, commentHints)
  };
}
/**
 * Given the node path of a Trans component, try to extract its key from its
 *   attributes.
 * @param path node path of the Trans component.
 * @returns the component key if it was found.
 * @throws ExtractionError if the i18nKey attribute was present but not
 *   evaluable.
 */


function parseTransComponentKeyFromAttributes(path) {
  const error = new ExtractionError(`Couldn't evaluate i18next key in Trans component. You should either ` + `make the i18nKey attribute evaluable or skip the line using a skip ` + `comment (/* ${COMMENT_HINTS_KEYWORDS.DISABLE.LINE} */ or /* ` + `${COMMENT_HINTS_KEYWORDS.DISABLE.NEXT_LINE} */).`, path);
  const keyAttribute = findJSXAttributeByName(path, 'i18nKey');
  if (!keyAttribute) return null;
  const keyAttributeValue = keyAttribute.get('value');
  const keyEvaluation = evaluateIfConfident(keyAttributeValue.isJSXExpressionContainer() ? keyAttributeValue.get('expression') : keyAttributeValue);

  if (typeof keyEvaluation !== 'string') {
    throw error;
  }

  return keyEvaluation;
}
/**
 * Check if a JSX element has nested children or if it's a simple text node.
 *
 * Tries to mimic hasChildren function from React i18next:
 * see https://github.com/i18next/react-i18next/blob/8b6caf105/src/Trans.js#L6
 *
 * @param path node path of the JSX element to check
 * @returns whether the node has nested children
 */


function hasChildren(path) {
  const children = path.get('children').filter(path => {
    // Filter out empty JSX expression containers
    // (they do not count, even if they contain comments)
    if (path.isJSXExpressionContainer()) {
      const expression = path.get('expression');
      return !expression.isJSXEmptyExpression();
    }

    return true;
  });
  if (children.length === 0) return false;
  if (1 < children.length) return true;
  const child = children[0];

  if (child.isJSXExpressionContainer()) {
    let expression = child.get('expression');

    if (expression.isIdentifier()) {
      const resolvedExpression = resolveIdentifier(expression);

      if (resolvedExpression === null) {
        // We weren't able to resolve the identifier. We consider this as
        // an absence of children, but it isn't very relevant anyways
        // because the extraction is very likely to fail later on.
        return false;
      }

      expression = resolvedExpression;
    } // If the expression is a string, we have an interpolation like {"foo"}
    // The only other valid interpolation would be {{myVar}} but apparently,
    // it is considered as a nested child.


    return typeof evaluateIfConfident(expression) !== 'string';
  }

  return false;
}
/**
 * Format the key of a JSX element.
 *
 * @param path node path of the JSX element to format.
 * @param index the current index of the node being parsed.
 * @param config plugin configuration.
 * @returns key corresponding to the JSX element.
 */


function formatJSXElementKey(path, index, config) {
  const openingElement = path.get('openingElement');
  const closingElement = path.get('closingElement');
  let resultTagName = `${index}`; // Tag name we will use in the exported file

  const tagName = openingElement.get('name');

  if (openingElement.get('attributes').length === 0 && tagName.isJSXIdentifier() && config.transKeepBasicHtmlNodesFor.includes(tagName.node.name) && !hasChildren(path)) {
    // The tag name should not be transformed to an index
    resultTagName = tagName.node.name;

    if (closingElement.node === null) {
      // opening tag without closing tag (e.g. <br />)
      return `<${resultTagName}/>`;
    }
  } // it's nested. let's recurse.


  return `<${resultTagName}>${parseTransComponentKeyFromChildren(path, config)}</${resultTagName}>`;
}
/**
 * Given the node path of a Trans component, try to extract its key from its
 *   children.
 * @param path node path of the Trans component.
 * @returns the component key if it was found.
 * @throws ExtractionError if the extraction did not succeed.
 */


function parseTransComponentKeyFromChildren(path, config) {
  const transComponentExtractionError = new ExtractionError(`Couldn't evaluate i18next key in Trans component. You should either ` + `set the i18nKey attribute to an evaluable value, or make the Trans ` + `component content evaluable or skip the line using a skip comment ` + `(/* ${COMMENT_HINTS_KEYWORDS.DISABLE.LINE} */ or /* ` + `${COMMENT_HINTS_KEYWORDS.DISABLE.NEXT_LINE} */).`, path);
  let children = path.get('children');
  let result = ''; // Filter out JSXText nodes that only consist of whitespaces with one or
  // more linefeeds. Such node do not count for the indices.

  children = children.filter(child => {
    return !(child.isJSXText() && child.node.value.trim() === '' && child.node.value.includes('\n'));
  }); // Filter out empty containers. They do not affect indices.

  children = children.filter(p => {
    if (!p.isJSXExpressionContainer()) return true;
    const expr = p.get('expression');
    return !expr.isJSXEmptyExpression();
  }); // We can then iterate on the children.

  for (let [i, child] of children.entries()) {
    if (child.isJSXExpressionContainer()) {
      // We have an expression container: {…}
      const expression = child.get('expression');
      const evaluation = evaluateIfConfident(expression);

      if (evaluation !== null && typeof evaluation === 'string') {
        // We have an evaluable JSX expression like {'hello'}
        result += evaluation.toString();
        continue;
      }

      if (expression.isObjectExpression()) {
        // We have an expression like {{name}} or {{name: userName}}
        const it = iterateObjectExpression(expression);
        const key0 = it.next().value;

        if (!key0 || !it.next().done) {
          // Probably got empty object expression like {{}}
          // or {{foo,bar}}
          throw transComponentExtractionError;
        }

        result += `{{${key0[0]}}}`;
        continue;
      }

      if (expression.isIdentifier()) {
        // We have an identifier like {myPartialComponent}
        // We try to find the latest declaration and substitute the identifier.
        const declarationExpression = resolveIdentifier(expression);
        const evaluation = evaluateIfConfident(declarationExpression);

        if (evaluation !== null) {
          // It could be evaluated, it's probably something like 'hello'
          result += evaluation;
          continue;
        } else if (declarationExpression !== null && declarationExpression.isJSXElement()) {
          // It's a JSX element. Let's act as if it was inline and move along.
          child = declarationExpression;
        } else {
          throw transComponentExtractionError;
        }
      }
    }

    if (child.isJSXText()) {
      // Simple JSX text.
      result += // Let's sanitize the value a bit.
      child.node.value // Strip line returns at start
      .replace(/^\s*(\r?\n)+\s*/gm, '') // Strip line returns at end
      .replace(/\s*(\r?\n)+\s*$/gm, '') // Replace other line returns with one space
      .replace(/\s*(\r?\n)+\s*/gm, ' ');
      continue;
    }

    if (child.isJSXElement()) {
      // got a JSX element.
      result += formatJSXElementKey(child, i, config);
      continue;
    }
  }

  return result;
}
/**
 * Parse `Trans` component to extract all its translation keys and i18next
 * options.
 *
 * @param path: node path of Trans JSX element.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 * @param skipCheck: set to true if you know that the JSXElement
 *   already is a Trans component.
 */


function extractTransComponent(path, config, commentHints = [], skipCheck = false) {
  if (getCommentHintForPath(path, 'DISABLE', commentHints)) return [];
  if (!skipCheck && !isTransComponent(path)) return [];
  const keyEvaluationFromAttribute = parseTransComponentKeyFromAttributes(path);
  const keyEvaluationFromChildren = parseTransComponentKeyFromChildren(path, config);
  const parsedOptions = parseTransComponentOptions(path, commentHints);

  if (parsedOptions.defaultValue === null) {
    parsedOptions.defaultValue = keyEvaluationFromChildren;
  }

  return [{
    key: keyEvaluationFromAttribute || keyEvaluationFromChildren,
    parsedOptions,
    sourceNodes: [path.node],
    extractorName: extractTransComponent.name
  }];
}

/**
 * Extract custom Trans components.
 *
 * @param path: node path of potential custom Trans JSX element.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 */

function extractCustomTransComponent(path, config, commentHints = []) {
  if (getCommentHintForPath(path, 'DISABLE', commentHints)) return [];
  if (!isCustomImportedNode(config.cache.absoluteCustomTransComponents, path, path.get('openingElement').get('name'))) return [];
  return extractTransComponent(path, config, commentHints, true);
}

/**
 * Check whether a given CallExpression path is a global call to the `t`
 * function.
 *
 * @param path: node path to check
 * @param config: plugin configuration
 * @returns true if the given call expression is indeed a call to i18next.t.
 */

function isSimpleTCall(path, config) {
  const callee = path.get('callee');
  if (!callee.isIdentifier()) return false;
  return config.tFunctionNames.includes(callee.node.name);
}
/**
 * Parse options of a `t(…)` call.
 * @param path: NodePath representing the second argument of the `t()` call
 *   (i.e. the i18next options)
 * @returns an object indicating whether the parsed options have context
 *   and/or count.
 */


function parseTCallOptions(path) {
  const res = {
    contexts: false,
    hasCount: false,
    ns: null,
    defaultValue: null
  };
  if (!path) return res; // Try brutal evaluation of defaultValue first.

  const optsEvaluation = evaluateIfConfident(path);

  if (typeof optsEvaluation === 'string') {
    res.defaultValue = optsEvaluation;
  } else if (path.isObjectExpression()) {
    // It didn't work. Let's try to parse as object expression.
    res.contexts = findKeyInObjectExpression(path, 'context') !== null;
    res.hasCount = findKeyInObjectExpression(path, 'count') !== null;
    const nsNode = findKeyInObjectExpression(path, 'ns');

    if (nsNode !== null && nsNode.isObjectProperty()) {
      const nsValueNode = nsNode.get('value');
      const nsEvaluation = evaluateIfConfident(nsValueNode);
      res.ns = getFirstOrNull(nsEvaluation);
    }

    const defaultValueNode = findKeyInObjectExpression(path, 'defaultValue');

    if (defaultValueNode !== null && defaultValueNode.isObjectProperty()) {
      const defaultValueNodeValue = defaultValueNode.get('value');
      res.defaultValue = evaluateIfConfident(defaultValueNodeValue);
    }
  }

  return res;
}
/**
 * Given a call to the `t()` function, find the key and the options.
 *
 * @param path NodePath of the `t()` call.
 * @param commentHints parsed comment hints
 * @throws ExtractionError when the extraction failed for the `t` call.
 */


function extractTCall(path, commentHints) {
  const args = path.get('arguments');
  const keyEvaluation = evaluateIfConfident(args[0]);

  if (typeof keyEvaluation !== 'string') {
    throw new ExtractionError(`Couldn't evaluate i18next key. You should either make the key ` + `evaluable or skip the line using a skip comment (/* ` + `${COMMENT_HINTS_KEYWORDS.DISABLE.LINE} */ or /* ` + `${COMMENT_HINTS_KEYWORDS.DISABLE.NEXT_LINE} */).`, path);
  }

  return {
    key: keyEvaluation,
    parsedOptions: { ...parseTCallOptions(args[1]),
      ...parseI18NextOptionsFromCommentHints(path, commentHints)
    },
    sourceNodes: [path.node],
    extractorName: extractTFunction.name
  };
}
/**
 * Parse a call expression (likely a call to a `t` function) to find its
 * translation keys and i18next options.
 *
 * @param path: node path of the t function call.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 * @param skipCheck: set to true if you know that the call expression arguments
 *   already is a `t` function.
 */


function extractTFunction(path, config, commentHints = [], skipCheck = false) {
  if (getCommentHintForPath(path, 'DISABLE', commentHints)) return [];
  if (!skipCheck && !isSimpleTCall(path, config)) return [];
  return [extractTCall(path, commentHints)];
}

/**
 * Check whether a given CallExpression path is a call to `useTranslation` hook.
 * @param path: node path to check
 * @returns true if the given call expression is indeed a call to
 *   `useTranslation`
 */

function isUseTranslationHook(path) {
  const callee = path.get('callee');
  return referencesImport(callee, 'react-i18next', 'useTranslation');
}
/**
 * Parse `useTranslation()` hook to extract all its translation keys and
 * options.
 * @param path: useTranslation call node path.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 */


function extractUseTranslationHook(path, config, commentHints = [], skipCheck = false) {
  if (!skipCheck && !isUseTranslationHook(path)) return [];
  let ns;
  const nsCommentHint = getCommentHintForPath(path, 'NAMESPACE', commentHints);

  if (nsCommentHint) {
    // We got a comment hint, take its value as namespace.
    ns = nsCommentHint.value;
  } else {
    // Otherwise, try to get namespace from arguments.
    const namespaceArgument = path.get('arguments')[0];
    ns = getFirstOrNull(evaluateIfConfident(namespaceArgument));
  }

  const parentPath = path.parentPath;
  if (!parentPath.isVariableDeclarator()) return [];
  const id = parentPath.get('id');
  const tBinding = id.scope.bindings['t'];
  if (!tBinding) return [];
  let keys = Array();

  for (const reference of tBinding.referencePaths) {
    if (reference.parentPath.isCallExpression() && reference.parentPath.get('callee') === reference) {
      keys = [...keys, ...extractTFunction(reference.parentPath, config, commentHints, true).map(k => ({ // Add namespace if it was not explicitely set in t() call.
        ...k,
        parsedOptions: { ...k.parsedOptions,
          ns: k.parsedOptions.ns || ns
        }
      }))];
    }
  }

  return keys.map(k => ({ ...k,
    sourceNodes: [path.node, ...k.sourceNodes],
    extractorName: extractUseTranslationHook.name
  }));
}

/**
 * Extract custom useTranslation hooks.
 *
 * @param path: node path of potential custom useTranslation hook calls.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 */

function extractCustomUseTranslationHook(path, config, commentHints = []) {
  if (getCommentHintForPath(path, 'DISABLE', commentHints)) return [];

  if (!isCustomImportedNode(config.cache.absoluteCustomHooks, path, path.get('callee'))) {
    return [];
  }

  return extractUseTranslationHook(path, config, commentHints, true);
}

/**
 * Check whether a given CallExpression path is a call to `getFixedT()`
 *    function.
 * @param path: node path to check
 * @param config: plugin configuration
 * @returns true if the given call expression is indeed a call to
 *   `getFixedT`
 */

function isGetFixedTFunction(path, config) {
  const callee = path.get('callee');
  return referencesChildIdentifier(callee, config.i18nextInstanceNames, 'getFixedT');
}
/**
 * Parse `getFixedT()` getter to extract all its translation keys and
 * options (see https://www.i18next.com/overview/api#getfixedt)
 * @param path: useTranslation call node path.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 */


function extractGetFixedTFunction(path, config, commentHints = []) {
  if (!isGetFixedTFunction(path, config)) return [];
  let ns;
  const nsCommentHint = getCommentHintForPath(path, 'NAMESPACE', commentHints);

  if (nsCommentHint) {
    // We got a comment hint, take its value as namespace.
    ns = nsCommentHint.value;
  } else {
    // Otherwise, try to get namespace from arguments.
    const namespaceArgument = path.get('arguments')[1];
    ns = getFirstOrNull(evaluateIfConfident(namespaceArgument));
  }

  const parentPath = path.parentPath;
  if (!parentPath.isVariableDeclarator()) return [];
  const id = parentPath.get('id');
  if (!id.isIdentifier()) return [];
  const tBinding = id.scope.bindings[id.node.name];
  if (!tBinding) return [];
  let keys = Array();

  for (const reference of tBinding.referencePaths) {
    if (reference.parentPath.isCallExpression() && reference.parentPath.get('callee') === reference) {
      keys = [...keys, ...extractTFunction(reference.parentPath, config, commentHints, true).map(k => ({ // Add namespace if it was not explicitely set in t() call.
        ...k,
        parsedOptions: { ...k.parsedOptions,
          ns: k.parsedOptions.ns || ns
        }
      }))];
    }
  }

  return keys.map(k => ({ ...k,
    sourceNodes: [path.node, ...k.sourceNodes],
    extractorName: extractGetFixedTFunction.name
  }));
}

/**
 * Check whether a given CallExpression path is a global call to `i18next.t`
 * function.
 * @param path: node path to check
 * @param config: plugin configuration
 * @returns true if the given call expression is indeed a call to i18next.t.
 */

function isI18nextTCall(path, config) {
  const callee = path.get('callee');
  return referencesChildIdentifier(callee, config.i18nextInstanceNames, 't');
}
/**
 * Parse a call expression (likely `i18next.t`) to find its translation keys
 * and i18next options.
 *
 * @param path: node path of the t function call.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 * @param skipCheck: set to true if you know that the call expression arguments
 *   already is a `t` function.
 */


function extractI18nextInstance(path, config, commentHints = []) {
  if (getCommentHintForPath(path, 'DISABLE', commentHints)) return [];
  if (!isI18nextTCall(path, config)) return [];
  return extractTFunction(path, config, commentHints, true).map(k => ({ ...k,
    sourceNodes: [path.node, ...k.sourceNodes],
    extractorName: extractI18nextInstance.name
  }));
}

/**
 * Check whether a given JSXElement is a Translation render prop.
 * @param path: node path to check
 * @returns true if the given element is indeed a `Translation` render prop.
 */

function isTranslationRenderProp(path) {
  const openingElement = path.get('openingElement');
  return referencesImport(openingElement.get('name'), 'react-i18next', 'Translation');
}
/**
 * Parse `Translation` render prop to extract all its translation keys and
 * options.
 *
 * @param path: node path of Translation JSX element.
 * @param config: plugin configuration
 * @param commentHints: parsed comment hints
 */


function extractTranslationRenderProp(path, config, commentHints = []) {
  if (!isTranslationRenderProp(path)) return [];
  let ns;
  const nsCommentHint = getCommentHintForPath(path, 'NAMESPACE', commentHints);

  if (nsCommentHint) {
    // We got a comment hint, take its value as namespace.
    ns = nsCommentHint.value;
  } else {
    // Try to parse ns property
    const nsAttr = findJSXAttributeByName(path, 'ns');

    if (nsAttr) {
      let value = nsAttr.get('value');
      if (value.isJSXExpressionContainer()) value = value.get('expression');
      ns = getFirstOrNull(evaluateIfConfident(value));
    }
  } // We expect at least "<Translation>{(t) => …}</Translation>


  const expressionContainer = path.get('children').filter(p => p.isJSXExpressionContainer())[0];
  if (!expressionContainer || !expressionContainer.isJSXExpressionContainer()) return [];
  const expression = expressionContainer.get('expression');
  if (!expression.isArrowFunctionExpression()) return [];
  const tParam = expression.get('params')[0];
  if (!tParam) return [];
  const tBinding = tParam.scope.bindings['t'];
  if (!tBinding) return [];
  let keys = Array();

  for (const reference of tBinding.referencePaths) {
    if (reference.parentPath.isCallExpression() && reference.parentPath.get('callee') === reference) {
      keys = [...keys, ...extractTFunction(reference.parentPath, config, commentHints, true).map(k => ({ // Add namespace if it was not explicitely set in t() call.
        ...k,
        parsedOptions: { ...k.parsedOptions,
          ns: k.parsedOptions.ns || ns
        }
      }))];
    }
  }

  return keys.map(k => ({ ...k,
    sourceNodes: [path.node, ...k.sourceNodes],
    extractorName: extractTranslationRenderProp.name
  }));
}

/**
 * Check whether a given node is a withTranslation call expression.
 *
 * @param path Node path to check
 * @returns true if the given node is an HOC call expression.
 */

function isWithTranslationHOCCallExpression(path) {
  return path.isCallExpression() && referencesImport(path.get('callee'), 'react-i18next', 'withTranslation');
}
/**
 * If the given node is wrapped in a withTranslation call expression,
 * then return the call expression.
 *
 * @param path node path that is suspected to be part of a withTranslation call expression.
 * @returns withTranslation call expression if found, else null
 */


function findWithTranslationHOCCallExpressionInParents(path) {
  const callExpr = path.findParent(parentPath => {
    if (!parentPath.isCallExpression()) return false;
    const callee = parentPath.get('callee');
    return isWithTranslationHOCCallExpression(callee);
  });

  if (callExpr === null) {
    return null;
  }

  const callee = callExpr.get('callee');
  if (Array.isArray(callee) || !callee.isCallExpression()) return null;
  return callee;
}
/**
 * Just like findWithTranslationHOCCallExpressionInParents, finds a withTranslation call
 * expression, but expects the callExpression to be curried in a "compose" function.
 *
 * e.g. compose(connect(), withTranslation())(MyComponent)
 *
 * @param path node path that is suspected to be part of a composed withTranslation call
 *   expression.
 * @returns withTranslation call expression if found, else null
 */


function findWithTranslationHOCCallExpressionInCompose(path) {
  const composeFunctionNames = ['compose', 'flow', 'flowRight'];
  let currentPath = path.parentPath;
  let withTranslationCallExpr = null;

  while (currentPath.isCallExpression()) {
    if (withTranslationCallExpr === null) {
      const args = currentPath.get('arguments');
      withTranslationCallExpr = args.find(isWithTranslationHOCCallExpression) || null;
    }

    let callee = currentPath.get('callee');

    if (callee.isMemberExpression()) {
      // If we have a member expression, we take the right operand
      // e.g. _.compose
      const result = callee.get('property');

      if (!Array.isArray(result)) {
        callee = result;
      }
    }

    if (callee.isIdentifier() && composeFunctionNames.includes(callee.node.name)) {
      return withTranslationCallExpr;
    }

    currentPath = callee;
  }

  return null;
}
/**
 * Find whether a given function or class is wrapped with "withTranslation" HOC
 * somewhere.
 * @param path Function or class declaration node path.
 * @returns "withTranslation()()" call expression if found. Else null.
 */


function findWithTranslationHOCCallExpression(path) {
  let functionIdentifier = path.get('id');

  if (!Array.isArray(functionIdentifier) && !functionIdentifier.isIdentifier() && path.parentPath.isVariableDeclarator()) {
    // It doesn't look like "function MyComponent(…)"
    // but could be "const MyComponent = (…) => …" or "const MyComponent = function(…) { … }"
    functionIdentifier = path.parentPath.get('id');
  }

  if (Array.isArray(functionIdentifier) || !functionIdentifier.isIdentifier()) return null;
  const bindings = path.parentPath.scope.bindings[functionIdentifier.node.name]; // Likely an anonymous function not in a normal scope.
  // e.g. "['foo', function myFunction() { return 'foo'; }]"
  // Let's just ignore such case.

  if (!bindings) return null; // Try to find a withTranslation() call in parent scope

  for (const refPath of bindings.referencePaths) {
    const callee = findWithTranslationHOCCallExpressionInParents(refPath) || findWithTranslationHOCCallExpressionInCompose(refPath);

    if (callee !== null) {
      return callee;
    }
  }

  return null;
}
/**
 * Try to find "t" in an object spread. Useful when looking for the "t" key
 * in a spread object. e.g. const {t} = props;
 *
 * @param path object pattern
 * @returns t identifier or null of it was not found in the object pattern.
 */


function findTFunctionIdentifierInObjectPattern(path) {
  const props = path.get('properties');

  for (const prop of props) {
    if (prop.isObjectProperty()) {
      const key = prop.get('key');

      if (!Array.isArray(key) && key.isIdentifier() && key.node.name === 't') {
        return key;
      }
    }
  }

  return null;
}
/**
 * Check whether a node path is the callee of a call expression.
 *
 * @param path the node to check.
 * @returns true if the path is the callee of a call expression.
 */


function isCallee(path) {
  return path.parentPath.isCallExpression() && path === path.parentPath.get('callee');
}
/**
 * Find T function calls from a props assignment. Prop assignment can occur
 * in function parameters (i.e. "function Component(props)" or
 * "function Component({t})") or in a variable declarator (i.e.
 * "const props = …" or "const {t} = props").
 *
 * @param propsId identifier for the prop assignment. e.g. "props" or "{t}"
 * @returns Call expressions to t function.
 */


function findTFunctionCallsFromPropsAssignment(propsId) {
  const tReferences = Array();
  const body = propsId.parentPath.get('body');
  if (Array.isArray(body)) return [];
  const scope = body.scope;

  if (propsId.isObjectPattern()) {
    // got "function MyComponent({t, other, props})"
    // or "const {t, other, props} = this.props"
    // we want to find references to "t"
    const tFunctionIdentifier = findTFunctionIdentifierInObjectPattern(propsId);
    if (tFunctionIdentifier === null) return [];
    const tBinding = scope.bindings[tFunctionIdentifier.node.name];
    tReferences.push(...tBinding.referencePaths);
  } else if (propsId.isIdentifier()) {
    // got "function MyComponent(props)"
    // or "const props = this.props"
    // we want to find references to props.t
    const references = scope.bindings[propsId.node.name].referencePaths;

    for (const reference of references) {
      if (reference.parentPath.isMemberExpression()) {
        const prop = reference.parentPath.get('property');

        if (!Array.isArray(prop) && prop.node.name === 't') {
          tReferences.push(reference.parentPath);
        }
      }
    }
  } // We have candidates. Let's see if t references are actual calls to the t
  // function


  const tCalls = Array();

  for (const tCall of tReferences) {
    if (isCallee(tCall)) {
      tCalls.push(tCall.parentPath);
    }
  }

  return tCalls;
}
/**
 * Find all t function calls in a class component.
 * @param path node path to the class component.
 */


function findTFunctionCallsInClassComponent(path) {
  const result = Array();
  const thisVisitor = {
    ThisExpression(path) {
      if (!path.parentPath.isMemberExpression()) return;
      const propProperty = path.parentPath.get('property');
      if (Array.isArray(propProperty) || !propProperty.isIdentifier()) return;
      if (propProperty.node.name !== 'props') return; // Ok, this is interesting, we have something with "this.props"

      if (path.parentPath.parentPath.isMemberExpression()) {
        // We have something in the form "this.props.xxxx".
        const tIdentifier = path.parentPath.parentPath.get('property');
        if (Array.isArray(tIdentifier) || !tIdentifier.isIdentifier()) return;
        if (tIdentifier.node.name !== 't') return; // We have something in the form "this.props.t". Let's see if it's an
        // actual function call or an assignment.

        const tExpression = path.parentPath.parentPath;

        if (isCallee(tExpression)) {
          // Simple case. Direct call to "this.props.t()"
          result.push(tExpression.parentPath);
        } else if (tExpression.parentPath.isVariableDeclarator()) {
          // Hard case. const t = this.props.t;
          // Let's loop through all references to t.
          const id = tExpression.parentPath.get('id');
          if (!id.isIdentifier()) return;

          for (const reference of id.scope.bindings[id.node.name].referencePaths) {
            if (isCallee(reference)) {
              result.push(reference.parentPath);
            }
          }
        }
      } else if (path.parentPath.parentPath.isVariableDeclarator()) {
        // We have something in the form "const props = this.props"
        // Or "const {t} = this.props"
        const id = path.parentPath.parentPath.get('id');
        result.push(...findTFunctionCallsFromPropsAssignment(id));
      }
    }

  };
  path.traverse(thisVisitor);
  return result;
}
/**
 * Find t function calls in a function component.
 * @param path node path to the function component.
 */


function findTFunctionCallsInFunctionComponent(path) {
  const propsParam = path.get('params')[0];
  if (propsParam === undefined) return [];
  return findTFunctionCallsFromPropsAssignment(propsParam);
}
/**
 * Parse function or class declaration (likely components) to find whether
 * they are wrapped with "withTranslation()" HOC, and if so, extract all the
 * translations that come from the "t" function injected in the component
 * properties.
 *
 * @param path node path to the component
 * @param config plugin configuration
 * @param commentHints parsed comment hints
 */


function extractWithTranslationHOC(path, config, commentHints = []) {
  // Detect if this component is wrapped with withTranslation() somewhere
  const withTranslationCallExpression = findWithTranslationHOCCallExpression(path);
  if (withTranslationCallExpression === null) return [];
  let tCalls;

  if (path.isClassDeclaration()) {
    tCalls = findTFunctionCallsInClassComponent(path);
  } else {
    tCalls = findTFunctionCallsInFunctionComponent(path);
  } // Extract namespace


  let ns;
  const nsCommentHint = getCommentHintForPath(withTranslationCallExpression, 'NAMESPACE', commentHints);

  if (nsCommentHint) {
    // We got a comment hint, take its value as namespace.
    ns = nsCommentHint.value;
  } else {
    // Otherwise, try to get namespace from arguments.
    const namespaceArgument = withTranslationCallExpression.get('arguments')[0];
    ns = getFirstOrNull(evaluateIfConfident(namespaceArgument));
  }

  let keys = Array();

  for (const tCall of tCalls) {
    keys = [...keys, ...extractTFunction(tCall, config, commentHints, true).map(k => ({ // Add namespace if it was not explicitely set in t() call.
      ...k,
      parsedOptions: { ...k.parsedOptions,
        ns: k.parsedOptions.ns || ns
      }
    }))];
  }

  return keys.map(k => ({ ...k,
    sourceNodes: [path.node, ...k.sourceNodes],
    extractorName: extractWithTranslationHOC.name
  }));
}

/**
 * All extractors sorted by priority.
 */

const EXTRACTORS_PRIORITIES = [extractCustomTransComponent.name, extractTransComponent.name, extractCustomUseTranslationHook.name, extractUseTranslationHook.name, extractGetFixedTFunction.name, extractTranslationRenderProp.name, extractWithTranslationHOC.name, extractI18nextInstance.name, extractTFunction.name];
var Extractors = {
  extractCustomTransComponent,
  extractTransComponent,
  extractUseTranslationHook,
  extractCustomUseTranslationHook,
  extractGetFixedTFunction,
  extractTranslationRenderProp,
  extractWithTranslationHOC,
  extractI18nextInstance,
  extractTFunction
};

/**
 * Parse namespace and key path from an extracted key.
 * @param key: key to parse
 * @param config: plugin configuration
 */
function parseExtractedKey(key, config) {
  let cleanKey = key.key;
  let ns = key.parsedOptions.ns || config.defaultNS;

  if (config.nsSeparator) {
    const nsSeparatorPos = cleanKey.indexOf(config.nsSeparator);

    if (nsSeparatorPos !== -1) {
      ns = cleanKey.slice(0, nsSeparatorPos);
      cleanKey = cleanKey.slice(nsSeparatorPos + 1);
    }
  }

  let keyPath = Array();

  if (config.keySeparator) {
    const fullPath = cleanKey.split(config.keySeparator);
    keyPath = fullPath.slice(0, fullPath.length - 1);
    cleanKey = fullPath[fullPath.length - 1];
  }

  return { ...key,
    cleanKey,
    keyPath,
    ns,
    isDerivedKey: false
  };
}
/**
 * Compute all derived keys for a local from a key and parsed i18next options.
 *
 * e.g.
 *   ({'foo', {contexts: false, hasCount: true}}, 'en')
 *     => ['foo', 'foo_plural']
 *   ({'bar', {contexts: ['male', 'female'], hasCount: true}}, 'en')
 *     => ['foo_male', 'foo_male_plural', 'foo_female', 'foo_female_plural']
 *
 * @param extractedKey key that was extracted with an extractor.
 * @param locale locale code
 * @returns All derived keys that could be found from TranslationKey for
 *   locale.
 */


function computeDerivedKeys(extractedKey, locale, config) {
  const translationKey = parseExtractedKey(extractedKey, config);
  const {
    parsedOptions,
    cleanKey: key
  } = translationKey;
  let keys = [translationKey];

  if (parsedOptions.contexts !== false) {
    // Add all context suffixes
    // For instance, if key is "foo", may want
    // ["foo", "foo_male", "foo_female"] depending on defaultContexts value.
    const contexts = Array.isArray(parsedOptions.contexts) ? parsedOptions.contexts : config.defaultContexts;
    keys = contexts.map(v => {
      if (v === '') return translationKey;
      return { ...translationKey,
        cleanKey: key + config.contextSeparator + v,
        isDerivedKey: true
      };
    });
  }

  if (parsedOptions.hasCount) {
    // See https://www.i18next.com/translation-function/plurals#how-to-find-the-correct-plural-suffix
    const pluralRule = i18next.services.pluralResolver.getRule(locale);

    if (pluralRule === undefined) {
      throw new Error(`Locale '${locale}' does not exist.`);
    }

    const numberOfPlurals = pluralRule.numbers.length;

    if (config.enableExperimentalIcu) {
      const pluralNumbersAsText = Array.from(new Set(pluralRule.numbers.map(pluralNumberToText)));
      const icuPlurals = pluralNumbersAsText.map(numAsText => `${numAsText} {${icuPluralValue(extractedKey.parsedOptions.defaultValue)}}`).join(' ');
      extractedKey.parsedOptions.defaultValue = `{count, plural, ${icuPlurals}`;
    } else {
      if (numberOfPlurals === 1) {
        keys = keys.map(k => ({ ...k,
          cleanKey: k.cleanKey + config.pluralSeparator + '0',
          isDerivedKey: true
        }));
      } else if (numberOfPlurals === 2) {
        keys = keys.reduce((accumulator, k) => [...accumulator, k, { ...k,
          cleanKey: k.cleanKey + config.pluralSeparator + 'plural',
          isDerivedKey: true
        }], Array());
      } else {
        keys = keys.reduce((accumulator, k) => [...accumulator, ...Array(numberOfPlurals).fill(null).map((_, idx) => ({ ...k,
          cleanKey: k.cleanKey + config.pluralSeparator + idx,
          isDerivedKey: true
        }))], Array());
      }
    }
  }

  return keys;
}

function pluralNumberToText(number) {
  switch (number) {
    case 0:
      return 'zero';

    case 1:
      return 'one';

    default:
      return 'other';
  }
}

function icuPluralValue(defaultValue) {
  const oldVal = defaultValue || '';
  const withIcuSingleCurlyBrace = oldVal.replace(/{{/g, '{').replace(/}}/g, '}');
  return withIcuSingleCurlyBrace;
}

/**
 * Handle the extraction.
 *
 * In case of ExtractionError occurring in the callback, a useful error
 * message will display and extraction will continue.
 *
 * @param path Current node path.
 * @param state Current visitor state.
 * @param callback Function to call that may throw ExtractionError.
 */
function handleExtraction(path, state, callback) {
  const filename = state.file && state.file.opts.filename || '???';
  const extractState = state.I18NextExtract;

  const collect = newKeysCandidates => {
    const currentKeys = extractState.extractedKeys;
    const newKeys = Array();

    for (const newKeyCandidate of newKeysCandidates) {
      const conflictingKeyIndex = currentKeys.findIndex(extractedKey => extractedKey.sourceNodes.some(extractedNode => newKeyCandidate.sourceNodes.includes(extractedNode)));

      if (conflictingKeyIndex !== -1) {
        const conflictingKey = currentKeys[conflictingKeyIndex];
        const conflictingKeyPriority = -EXTRACTORS_PRIORITIES.findIndex(v => v === conflictingKey.extractorName);
        const newKeyPriority = -EXTRACTORS_PRIORITIES.findIndex(v => v === newKeyCandidate.extractorName);

        if (newKeyPriority <= conflictingKeyPriority) {
          // Existing key priority is higher than the extracted key priority.
          // Skip.
          continue;
        } // Remove the conflicting key from the extracted keys


        currentKeys.splice(conflictingKeyIndex, 1);
      }

      newKeys.push(newKeyCandidate);
    }

    currentKeys.push(...newKeys);
  };

  try {
    return callback(collect);
  } catch (err) {
    if (!(err instanceof ExtractionError)) {
      throw err;
    }

    const lineNumber = err.nodePath.node.loc && err.nodePath.node.loc.start.line || '???'; // eslint-disable-next-line no-console

    console.warn(`${PLUGIN_NAME}: Extraction error in ${filename} at line ` + `${lineNumber}. ${err.message}`);
  }
}

const Visitor = {
  CallExpression(path, state) {
    const extractState = this.I18NextExtract;
    handleExtraction(path, state, collect => {
      collect(Extractors.extractCustomUseTranslationHook(path, extractState.config, extractState.commentHints));
      collect(Extractors.extractUseTranslationHook(path, extractState.config, extractState.commentHints));
      collect(Extractors.extractGetFixedTFunction(path, extractState.config, extractState.commentHints));
      collect(Extractors.extractI18nextInstance(path, extractState.config, extractState.commentHints));
      collect(Extractors.extractTFunction(path, extractState.config, extractState.commentHints));
    });
  },

  JSXElement(path, state) {
    const extractState = this.I18NextExtract;
    handleExtraction(path, state, collect => {
      collect(Extractors.extractTranslationRenderProp(path, extractState.config, extractState.commentHints));
      collect(Extractors.extractCustomTransComponent(path, extractState.config, extractState.commentHints));
      collect(Extractors.extractTransComponent(path, extractState.config, extractState.commentHints));
    });
  },

  ClassDeclaration(path, state) {
    const extractState = this.I18NextExtract;
    handleExtraction(path, state, collect => {
      collect(extractWithTranslationHOC(path, extractState.config, extractState.commentHints));
    });
  },

  Function(path, state) {
    const extractState = this.I18NextExtract;
    handleExtraction(path, state, collect => {
      collect(extractWithTranslationHOC(path, extractState.config, extractState.commentHints));
    });
  }

};
function plugin (api) {
  api.assertVersion(7); // This is a cache for the exporter to keep track of the translation files.
  // It must remain global and persist across transpiled files.

  const exporterCache = createExporterCache();
  return {
    pre() {
      this.I18NextExtract = {
        config: parseConfig(this.opts),
        extractedKeys: [],
        commentHints: [],
        exporterCache
      };
    },

    post() {
      const extractState = this.I18NextExtract;
      if (extractState.extractedKeys.length === 0) return;

      for (const locale of extractState.config.locales) {
        const derivedKeys = extractState.extractedKeys.reduce((accumulator, k) => [...accumulator, ...computeDerivedKeys(k, locale, extractState.config)], Array());
        exportTranslationKeys(derivedKeys, locale, extractState.config, extractState.exporterCache);
      }
    },

    visitor: {
      Program(path, state) {
        // FIXME can't put this in Visitor because `path.traverse()` on a
        // Program node doesn't call the visitor for Program node.
        if (isFile(path.container)) {
          this.I18NextExtract.commentHints = parseCommentHints(path.container.comments);
        }

        path.traverse(Visitor, state);
      }

    }
  };
}

i18next.init();

export default plugin;
