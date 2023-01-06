import { join } from 'path';
import getTranslator from '../src/translate';

async function main() {
    const translator = await getTranslator(
        'lang',
        join(__dirname, 'languages')
    );
    console.log(
        translator.t(['error_300', 'error_other'], { values: { code: 300 } })
    );
    console.log(
        translator.t(['error_404', 'error_other'], { values: { code: 404 } })
    );
    console.log(translator.t('friend', { count: 1 }));
    console.log(translator.t('friend', { count: 10 }));
    console.log(translator.t('friend', { count: 1, context: 'boy' }));
    console.log(translator.t('friend', { count: 10, context: 'boy' }));
    console.log(translator.t('friend', { count: 1, context: 'girl' }));
    console.log(translator.t('friend', { count: 10, context: 'girl' }));
    console.log(translator.t('doesnotexist', { values: { a: 'b', b: 'a' } }));
}
main();