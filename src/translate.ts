import { join } from 'path';
import replaceValues, { ReplacableValue } from './replacer';

type translateFunction =
    | ((key: string[], props: PropObj) => string | null)
    | ((
          key: string[],
          props: PropObj & { useMissingTranslation: false }
      ) => string | undefined | null);

interface ITranslator {
    getWithPrefix: (newPrefix: string) => ITranslator;
    t: translateFunction;
}

type PropObj = {
    values?: Record<string, ReplacableValue>;
    count?: number;
    context?: string;
    useMissingTranslation?: boolean;
    replacementFunctions?: Record<
        string,
        (str: string, ...args: string[]) => string
    >;
};

function getKey(obj: any, key: string): any {
    for (const v of key.split('.')) {
        obj = typeof obj !== 'undefined' && obj !== null ? obj[v] : obj;
    }
    return obj;
}

export class Translator implements ITranslator {
    keys: any;
    missingTranslation: string;
    languagename: string;
    prefix: string;

    constructor(
        keys: any,
        missingTranslation: string,
        langName: string,
        prefix?: string
    ) {
        this.keys = keys;
        this.missingTranslation = missingTranslation;
        this.languagename = langName;
        this.prefix = prefix || '';
    }

    t(key: string | string[], props: PropObj = {}) {
        const values = props.values || {};
        const info: Record<string, string> = this.info;
        if (props.count !== undefined) info.count = props.count.toString();
        if (props.context !== undefined) info.context = props.context;
        values.info ||= info;

        if (props.context !== undefined) props.context = '_' + props.context;
        const suffix = props.count
            ? [
                  (props.context || '') + '_' + props.count.toString(),
                  (props.context || '') + '_' + howmany(props.count),
                  (props.context || '') + '_other',
              ]
            : [props.context || ''];
        const newKey = (key instanceof Array ? key : [key])
            .map((el) =>
                suffix.map(
                    (suff) =>
                        (this.prefix.length > 0 ? this.prefix + '.' : '') +
                        el +
                        suff
                )
            )
            .flat();

        let value: any = undefined;
        for (const k of newKey) {
            const v = getKey(this.keys, k);
            if (v !== null && v !== undefined)
                return replaceValues(
                    v.toString(),
                    values,
                    props.replacementFunctions
                );
        }

        return value === null
            ? null
            : value === undefined
            ? props.useMissingTranslation !== false
                ? replaceValues(this.missingTranslation, {
                      key: newKey[newKey.length - 1],
                      info: this.info,
                      values: tryStringify(
                          { ...props.values, info: () => {} } || {}
                      ),
                  })
                : undefined
            : replaceValues(
                  value.toString(),
                  values,
                  props.replacementFunctions
              );
    }

    get info() {
        return {
            language: this.languagename,
            prefix: this.prefix,
            missingTranslation: this.missingTranslation,
        };
    }

    getWithPrefix(prefix: string) {
        return new Translator(
            this.keys,
            this.missingTranslation,
            this.languagename,
            prefix
        );
    }

    getPrefix() {
        return this.prefix;
    }

    get language() {
        return this.languagename;
    }
}

function howmany(num: number) {
    if (num < 3) return 'none';
    if (num < 30) return 'few';
    if (num < 100) return 'many';
    return 'lot';
}

function tryStringify(obj: any): string {
    try {
        return JSON.stringify(obj);
    } catch {}
    return 'Stringify failed!';
}

const languages: Record<string, { missingTranslation: string; keys: any }> = {};

export default async function getTranslator(
    language: string,
    folder: string,
    prefix?: string
) {
    const path = join(folder, language + '.json');
    if (languages[path])
        return new Translator(
            languages[path].keys,
            languages[path].missingTranslation,
            language,
            prefix
        );
    try {
        languages[path] = await import(path);
    } catch {
        return new FakeTranslator(
            'Could not find the translation file for ' +
                language +
                ' (path: ' +
                path +
                ')'
        );
    }
    return new Translator(
        languages[path].keys,
        languages[path].missingTranslation,
        language,
        prefix
    );
}

class FakeTranslator implements ITranslator {
    private msg: string;
    constructor(message: string) {
        this.msg = message;
    }

    getWithPrefix(newPrefix: string) {
        return this;
    }
    t(...args: any[]) {
        return this.msg;
    }
}
