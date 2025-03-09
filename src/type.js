/**
 * JSON to Go extension for VS Code.
 *
 * Date: March 2025
 * Author: Mario Petričko
 * GitHub: http://github.com/maracko/json-to-go-vsc
 *
 * Apache License
 * Version 2.0, January 2004
 * http://www.apache.org/licenses/
 *
 */

/**
 * @typedef {Object} TypeInfo An object containing type information.
 * @property {string[]} all An array of all types matched.
 * @property {(other: any)=> boolean} equalsType Check if another object has exactly the same types.
 * @property {(...types: string[])=> boolean} is Return true if object is of all provided types.
 * @property {(...types: string[])=> boolean} isNot Return true if object is not of any of the provided types.
 * @property {(what: { is?: string | string[], isNot?: string | string[] })=> boolean} match Return true if object matches all `is` types and none of the `isNot` types.
 * @property {()=> string} toString String representation of all types matched.
 */

/**
 * Type constants
 * @enum {string}
 */
const T = {
  asyncFunction: 'asyncFunction',
  asyncGeneratorFunction: 'asyncGeneratorFunction',
  array: 'array',
  bigint: 'bigint',
  boolean: 'boolean',
  date: 'date',
  error: 'error',
  function: 'function',
  generatorFunction: 'generatorFunction',
  map: 'map',
  null: 'null',
  number: 'number',
  object: 'object',
  promise: 'promise',
  regexp: 'regexp',
  set: 'set',
  symbol: 'symbol',
  string: 'string',
  undefined: 'undefined',
  weakMap: 'weakMap',
  weakRef: 'weakRef',
  weakSet: 'weakSet',
};

/**
 * toString(): [constructor, type]
 */
const _m = {
  '[object Array]': [Array, T.array],
  '[object AsyncFunction]': [undefined, T.asyncFunction],
  '[object AsyncGeneratorFunction]': [undefined, T.asyncGeneratorFunction],
  '[object BigInt]': [BigInt, T.bigint],
  '[object Boolean]': [Boolean, T.boolean],
  '[object Date]': [Date, T.date],
  '[object Error]': [Error, T.error],
  '[object Function]': [Function, T.function],
  '[object GeneratorFunction]': [undefined, T.generatorFunction],
  '[object Map]': [Map, T.map],
  '[object Null]': [undefined, T.null],
  '[object Number]': [Number, T.number],
  '[object Object]': [Object, T.object],
  '[object Promise]': [Promise, T.promise],
  '[object RegExp]': [RegExp, T.regexp],
  '[object Set]': [Set, T.set],
  '[object String]': [String, T.string],
  '[object Symbol]': [Symbol, T.symbol],
  '[object Undefined]': [undefined, T.undefined],
  '[object WeakMap]': [WeakMap, T.weakMap],
  '[object WeakRef]': [WeakRef, T.weakRef],
  '[object WeakSet]': [WeakSet, T.weakSet],
};

/**
 * Get type information of the provided argument
 * @param {any} obj The object to check.
 * @returns {TypeInfo} Result of the check.
 */
function type(obj) {
  let all = [typeof obj];

  const objToStr = Object.prototype.toString.call(obj);
  for (const [typToStr, [constructor, typStr]] of Object.entries(_m)) {
    if (
      typToStr === objToStr ||
      (constructor !== undefined && obj instanceof constructor)
    ) {
      all.push(typStr);
    }
  }

  if (Array.isArray(obj)) {
    all.push(T.array);
  }

  all = [...new Set(all)].sort();

  return {
    get all() {
      return all;
    },

    equalsType(other) {
      return this.toString() === type(other).toString();
    },

    is(...types) {
      types = liftArray(types);

      return types.every((t) => all.includes(t));
    },

    isNot(...types) {
      types = liftArray(types);

      return !types.some((t) => all.includes(t));
    },

    match({ is, isNot } = {}) {
      is = is || [];
      isNot = isNot || [];

      if (typeof is === T.string) is = [is];
      if (typeof isNot === T.string) isNot = [isNot];

      const matchAllIs = is.every((t) => all.includes(t));
      const matchAnyIsNot = isNot.some((t) => all.includes(t));

      return matchAllIs && !matchAnyIsNot;
    },

    toString() {
      return this.all.join(', ');
    },
  };
}

/**
 * Lift up array from variadic arguments if it is the only argument.
 * @param {any[]} varArg
 * @returns {any[]} The lifted or original array.
 */
function liftArray(varArg) {
  if (varArg.length === 1 && Array.isArray(varArg[0])) return varArg[0];
  else return varArg;
}

module.exports = { type, T };
