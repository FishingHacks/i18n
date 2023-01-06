type Replacable = string | number | Date | boolean;
export type ReplacableValue =
    | Replacable
    | Record<string, Replacable>
    | (() => Record<string, Replacable>)
    | (() => Replacable);

export const defaultReplacers = {
    date(str, ...args) {
        const [date, timezone, full] = args;

        return new Intl.DateTimeFormat(date, {
            dateStyle: full === 'true' ? 'full' : undefined,
            timeStyle: full === 'true' ? 'long' : undefined,
            timeZone: timezone || undefined,
        }).format(
            new Date(
                Number(
                    str.endsWith('n') ? str.substring(0, str.length - 1) : str
                )
            )
        );
    },
    number(str, ...args) {
        return new Intl.NumberFormat(args[0] || 'en-US').format(
            Number(str.endsWith('n') ? str.substring(0, str.length - 1) : str)
        );
    },
    currency(str, ...args) {
        return new Intl.NumberFormat(args[0] || 'en-US', {
            style: 'currency',
            currency: args[1] || 'EUR',
        }).format(
            Number(str.endsWith('n') ? str.substring(0, str.length - 1) : str)
        );
    },
    stringify(str, ...args) {
        args[0] ||= '  ';
        if (args[0].startsWith('"') && args[0].endsWith('"')) args[0] = args[0].substring(1, args[0].length - 1);
        try {
            return JSON.stringify(JSON.parse(str), null, args[0]);
        } catch {
            try {
                return JSON.stringify(str, null, args[0]);
            } catch {
                return str;
            }
        }
    },
} as Readonly<Record<string, (str: string, ...args: string[]) => string>>;

export default function replaceValues(
    str: string,
    values?: Record<string, ReplacableValue>,
    replacementFunctions?: Record<
        string,
        (str: string, ...args: string[]) => string
    >
): string {
    const newValues = transformValues(values || {});
    replacementFunctions ||= {};
    let newVal = '';
    let newStart = 0;

    for (const replacer of collectAllReplacers(str)) {
        newVal +=
            str.substring(newStart, replacer.start) +
            runReplacers(
                newValues[replacer.replacer.key],
                replacer.replacer.replacementFunctions,
                (name: string) =>
                    (replacementFunctions || {})[name] ||
                    defaultReplacers[name] ||
                    ((str: string) => str)
            );
        newStart = replacer.end + 1;
    }
    return newVal + str.substring(newStart);
}

function transformValues(
    values: Record<string, ReplacableValue>
): Record<string, string> {
    let keys: Record<string, string> = {};
    for (let [k, v] of Object.entries(values)) {
        if (typeof v === 'function') v = v();
        if (typeof v === 'object' && !(v instanceof Date)) {
            const obj: Record<string, string> = {};
            for (const [key, value] of Object.entries(v)) {
                const stringified = stringifyValue(value);
                if (stringified !== null) {
                    keys[k + '.' + key] = stringified;
                    obj[key] = stringified;
                }
            }
            keys[k] = JSON.stringify(obj);
        } else {
            const stringified = stringifyValue(v);
            if (stringified !== null) keys[k] = stringified;
        }
    }
    return keys;
}

function stringifyValue(value: any) {
    if (value === null) return 'null';
    if (value instanceof Date) return value.getTime().toString();
    if (typeof value === 'bigint') return value.toString() + 'n';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'function') return null;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'object') return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'symbol') return 'Symbol(' + value.description + ')';
    if (typeof value === 'undefined') return 'undefined';
    return null;
}

function runReplacers(
    str: string,
    replacers: ReplacementInfo['replacementFunctions'],
    getReplacer: (name: string) => Function
): string {
    for (const fn of replacers) {
        str = getReplacer(fn.name)(str, ...fn.arguments);
    }

    return str;
}

function collectAllReplacers(
    str: string
): { start: number; end: number; replacer: ReplacementInfo }[] {
    const replacerValues: [number, number][] = [];

    let start = 0;

    for (let i = 0; i < str.length; i++) {
        if (str[i] === '{') start = i;
        else if (str[i] === '}') replacerValues.push([start, i]);
    }

    return replacerValues
        .map(([start, end]) => ({
            end,
            start,
            replacer: makeReplacer(str.substring(start + 1, end)),
        }))
        .map((el) => {
            return el;
        })
        .filter((el) => !!el.replacer.key);
}

function makeReplacer(replacementKey: string): ReplacementInfo {
    let key = '';
    const replacementFunctions: ReplacementInfo['replacementFunctions'] = [];

    let tmp = '';
    let currentArguments = [];
    let currentFunctionName: string | null = null;

    for (const c of Object.values(replacementKey)) {
        if (c === ',' && !currentFunctionName && tmp && !key) {
            key = tmp.trim();
            tmp = '';
        } else if (c === ',' && !currentFunctionName) {
        } else if (c === ',' && currentFunctionName) {
            if (tmp) currentArguments.push(tmp.trim());
            tmp = '';
        } else if (c === ' ' && !currentFunctionName) {
        } else if (c === '(' && !currentFunctionName) {
            currentFunctionName = tmp.trim();
            tmp = '';
        } else if (c === ')' && !currentFunctionName)
            throw new SyntaxError('Expected a character or "(", found ")"');
        else if (c === ')' && currentFunctionName) {
            if (tmp.trim().length > 0) currentArguments.push(tmp.trim());
            replacementFunctions.push({
                name: currentFunctionName,
                arguments: currentArguments,
            });
            currentFunctionName = '';
            tmp = '';
            currentArguments = [];
        } else tmp += c;
    }

    if (replacementFunctions.length < 1 && !key) key = tmp.trim();

    return { key, replacementFunctions };
}

interface ReplacementInfo {
    key: string;
    replacementFunctions: { name: string; arguments: string[] }[];
}
