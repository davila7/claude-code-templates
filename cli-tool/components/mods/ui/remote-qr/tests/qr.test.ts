import { expect, test } from 'claude-code/testing'

import { OCTANTS, qrMatrix, qrText } from '../hooks/qr'

// Known-good codes: each was decoded back to its input by jsQR when recorded.
// One hex string per row, most significant bit = leftmost module, 1 = dark.
const GOLDEN: Record<string, { text: string; rows: string[] }> = {
  v1: { text: 'a', rows: [
    '1fc17f',
    '105d41',
    '17465d',
    '17495d',
    '17555d',
    '104d41',
    '1fd57f',
    '000300',
    '154a12',
    '0cbc46',
    '02d111',
    '101844',
    '10d155',
    '0012ab',
    '1fc2ef',
    '104bb8',
    '1752ed',
    '174046',
    '175111',
    '104c46',
    '1fd957',
  ] },
  v4: { text: 'https://claude.ai/code/session_01NT88s4MWSAzikzP4GKRMFn', rows: [
    '1fcb6ee7f',
    '105cbea41',
    '17412005d',
    '17498e65d',
    '17568465d',
    '104f4ee41',
    '1fd55557f',
    '00099cc00',
    '15423df12',
    '1389591e2',
    '03ea88ce7',
    '032129f90',
    '024f2a8e9',
    '0ea6235a5',
    '0ac6088a3',
    '0d95aca62',
    '06721b8cc',
    '0a8a551e1',
    '1ecf48c85',
    '0d0808a32',
    '17cc951e9',
    '07ba7bf03',
    '114d7c457',
    '08861dc79',
    '126d699fb',
    '001451b19',
    '1fca08755',
    '104d81911',
    '175fc3dfa',
    '1746eb61d',
    '175a81615',
    '1049efc1a',
    '1fd609f9b',
  ] },
  // Version 7 is the first with version information blocks.
  v7: { text: 'https://claude.ai/code/session_' + 'x'.repeat(100), rows: [
    '1fc8e5d88d17f',
    '1053cc7997f41',
    '17444112e635d',
    '174482900025d',
    '17559e7d5d85d',
    '10448b47ffc41',
    '1fd555555557f',
    '00021145ddd00',
    '154af6ff77612',
    '1e9e9cf22202d',
    '0e7ef96088987',
    '04333b1ffffd2',
    '1e6c47b777638',
    '0e858ea1230ad',
    '165da7c9ba907',
    '0a030a9c8dfd2',
    '03c6aef5d7678',
    '0883a0e08a021',
    '137dcd49d4987',
    '189fdb195dbd2',
    '04e42abfbfc58',
    '0606b4da2a01d',
    '11fecd7c80bf7',
    '011317c5ddd12',
    '0757565777558',
    '011688462231d',
    '0dff11fc88bf7',
    '02b68f51ffd62',
    '0a66817b75528',
    '0b2701a51028f',
    '176250bdabad7',
    '12b5696e65d71',
    '0cd57aa2235a9',
    '0e32300b76241',
    '08cc691e64a57',
    '0c849f35951f2',
    '02eb1263bbd28',
    '0b8e088a2228d',
    '08ea419c003d7',
    '0e153375ddd72',
    '1c601e7f775f8',
    '0012f4c62211d',
    '1fc9655488b57',
    '104d5bc5ffd12',
    '175d7fff777f8',
    '1743a244121de',
    '175707339bb74',
    '1041aab489e22',
    '1fdebae5df49b',
  ] },
  // Version 10 is the largest supported, and the first with a 16-bit length.
  v10: { text: 'x'.repeat(213), rows: [
    '1fcf4bbddddd67f',
    '1054e8e77777a41',
    '174a4842222265d',
    '1744e918888825d',
    '175344b7dddda5d',
    '1045a7e47777441',
    '1fd55555555557f',
    '0004bbb45dddf00',
    '154a42eff777612',
    '03bdbb4e222202d',
    '1a7a48148888987',
    '0e85abb1ddddfd2',
    '157ae26b7777678',
    '0e3d8b8e222202d',
    '1a7ee8148888987',
    '098deb71ddddfd0',
    '1672d1ab777767b',
    '0835090e222202d',
    '1d7eedd48888987',
    '0899e4b1ddddfd2',
    '16e7dd6b7777678',
    '08b20a4e222202d',
    '04f7edd48888987',
    '18a5ebb1ddddfd2',
    '06f2db6b7777678',
    '08aa064e222202d',
    '15f7e7d7c8889f7',
    '0916afbc5dddf12',
    '1f5117657777558',
    '131a3a44622211d',
    '17f6875fc888bf7',
    '1f175fb75dddd72',
    '0d6117263777528',
    '170aeac8a22228c',
    '13561719c888ad6',
    '193b6f375dddd72',
    '0be546a63777529',
    '130a59c8a22228d',
    '10560d99c888ad7',
    '1a3f42375dddd72',
    '0b6d44663777528',
    '13085288a22228d',
    '09d30999c888ad7',
    '0b3a4a375dddd72',
    '136246663777528',
    '0b8a5388a22228d',
    '14e00299c888ad7',
    '1f3bcc375dddd72',
    '00701667f7775f8',
    '0019938c622231d',
    '1fc152954888957',
    '10491cbc5dddf12',
    '1750f62ff7777f8',
    '174913c5e2221de',
    '1759b2934888b75',
    '1045bc7a1ddde22',
    '1fd8b5ecb77748b',
  ] },
}

const toRows = (m: boolean[][]) =>
  m.map(row => BigInt('0b' + row.map(d => (d ? '1' : '0')).join('')).toString(16).padStart(Math.ceil(row.length / 4), '0'))

test('matrices match known-good codes across version boundaries', async () => {
  for (const { text, rows } of Object.values(GOLDEN)) {
    const m = qrMatrix(text)
    expect(m?.length).toBe(rows.length)
    expect(toRows(m ?? [])).toEqual(rows)
  }
})

test('input past version 10 gives no code', async () => {
  expect(qrMatrix('x'.repeat(214))).toBe(null)
  expect(qrText('x'.repeat(214))).toBe(null)
})

test('the octant table is complete and anchored on the classic blocks', async () => {
  expect(OCTANTS.length).toBe(256)
  expect(new Set(OCTANTS).size).toBe(256)
  expect(OCTANTS[0]).toBe(' ')
  expect(OCTANTS[0b11111111]).toBe('█') // full block
  expect(OCTANTS[0b00001111]).toBe('▀') // upper half
  expect(OCTANTS[0b11110000]).toBe('▄') // lower half
  expect(OCTANTS[0b01010101]).toBe('▌') // left half
  expect(OCTANTS[0b10101010]).toBe('▐') // right half
  expect(OCTANTS[0b00000101]).toBe('▘') // upper left quadrant
  expect(OCTANTS[0b00000100]).toBe('𜴀') // first octant: dot 3 alone
})

test('the rendered text draws exactly the matrix, light modules on', async () => {
  const quiet = 2
  for (const { text } of Object.values(GOLDEN)) {
    const m = qrMatrix(text) ?? []
    const lines = (qrText(text, quiet) ?? '').split('\n').map(line => Array.from(line))
    const size = m.length + quiet * 2
    expect(lines.length).toBe(Math.ceil(size / 4))
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const mask = OCTANTS.indexOf(lines[y >> 2]?.[x >> 1] ?? '')
        const lit = ((mask >> (((y & 3) << 1) | (x & 1))) & 1) === 1
        const inCode = x >= quiet && y >= quiet && x < size - quiet && y < size - quiet
        expect(lit).toBe(!(inCode && m[y - quiet]?.[x - quiet]))
      }
  }
})
