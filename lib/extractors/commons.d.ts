import * as BabelCore from '@babel/core';
import * as BabelTypes from '@babel/types';
import { CommentHint } from '../comments';
import { ExtractedKey } from '../keys';
/**
 * Error thrown in case extraction of a node failed.
 */
export declare class ExtractionError extends Error {
    nodePath: BabelCore.NodePath;
    constructor(message: string, node: BabelCore.NodePath);
}
/**
 * Given a value, if the value is an array, return the first
 * item of the array. Otherwise, return the value.
 *
 * This is mainly useful to parse namespaces which can be strings
 * as well as array of strings.
 */
export declare function getFirstOrNull<T>(val: T | null | T[]): T | null;
/**
 * Given comment hints and a path, infer every I18NextOption we can from the comment hints.
 * @param path path on which the comment hints should apply
 * @param commentHints parsed comment hints
 * @returns every parsed option that could be infered.
 */
export declare function parseI18NextOptionsFromCommentHints(path: BabelCore.NodePath, commentHints: CommentHint[]): Partial<ExtractedKey['parsedOptions']>;
/**
 * Improved version of BabelCore `referencesImport` function that also tries to detect wildcard
 * imports.
 */
export declare function referencesImport(nodePath: BabelCore.NodePath, moduleSource: string, importName: string): boolean;
/**
 * Whether a class-instance function call expression matches a known method
 * @param nodePath: node path to evaluate
 * @param parentNames: list for any class-instance names to match
 * @param childName specific function from parent module to match
 */
export declare function referencesChildIdentifier(nodePath: BabelCore.NodePath, parentNames: string[], childName: string): boolean;
/**
 * Evaluates a node path if it can be evaluated with confidence.
 *
 * @param path: node path to evaluate
 * @returns null if the node path couldn't be evaluated
 */
export declare function evaluateIfConfident(path?: BabelCore.NodePath<any> | null): any;
/**
 * Generator that iterates on all keys in an object expression.
 * @param path the node path of the object expression
 * @param key the key to find in the object expression.
 * @yields [evaluated key, node path of the object expression property]
 */
export declare function iterateObjectExpression(path: BabelCore.NodePath<BabelTypes.ObjectExpression>): IterableIterator<[string, BabelCore.NodePath<BabelTypes.ObjectExpression['properties'][0]>]>;
/**
 * Try to find a key in an object expression.
 * @param path the node path of the object expression
 * @param key the key to find in the object expression.
 * @returns the corresponding node or null if it wasn't found
 */
export declare function findKeyInObjectExpression(path: BabelCore.NodePath<BabelTypes.ObjectExpression>, key: string): BabelCore.NodePath<BabelTypes.ObjectExpression['properties'][0]> | null;
/**
 * Find a JSX attribute given its name.
 * @param path path of the jsx attribute
 * @param name name of the attribute to look for
 * @return The JSX attribute corresponding to the given name, or null if no
 *   attribute with this name could be found.
 */
export declare function findJSXAttributeByName(path: BabelCore.NodePath<BabelTypes.JSXElement>, name: string): BabelCore.NodePath<BabelTypes.JSXAttribute> | null;
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
export declare function resolveIdentifier(nodePath: BabelCore.NodePath<BabelTypes.Identifier>): BabelCore.NodePath<BabelTypes.Expression> | null;
/**
 * Check whether a given node is a custom import.
 *
 * @param absoluteNodePaths: list of possible custom nodes, with their source
 *   modules and import names.
 * @param path: node path to check
 * @param name: node name to check
 * @returns true if the given node is a match.
 */
export declare function isCustomImportedNode(absoluteNodePaths: readonly [string, string][], path: BabelCore.NodePath, name: BabelCore.NodePath): boolean;
