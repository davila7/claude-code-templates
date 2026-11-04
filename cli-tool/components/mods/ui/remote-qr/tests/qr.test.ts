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
  v7: { text: 'https://claude.ai/code/session_' + 'x'.repeat(85), rows: [
    '1fc8eb0d717f',
    '105b6e87ca41',
    '174194e2225d',
    '174ae368835d',
    '175d4bfddf5d',
    '104507177041',
    '1fd55555557f',
    '0004cd17db00',
    '154929fb7a12',
    '10a78be1209d',
    '0d725b518197',
    '0415962ddfd2',
    '1dc7cf877678',
    '1b0d4e52202d',
    '08f9d2388987',
    '1611a86d7fd2',
    '11431d473478',
    '0f2c3712202d',
    '144482f83a87',
    '07a6082dddd2',
    '01f68df777f8',
    '0714f7122111',
    '0554b5588b57',
    '1b169113d711',
    '1df3f5f775fa',
    '1b8ef171228f',
    '0c5cf82282d7',
    '1116548ddd72',
    '1fcc55e7752b',
    '18b4375222cd',
    '0a74ff288a57',
    '03babd8dbde2',
    '0cf042d7f528',
    '0eb5f572028d',
    '016a7d683bd7',
    '0f285a0ddc72',
    '1373f7f775f8',
    '001d25122110',
    '1fcf13588b57',
    '10429513d913',
    '175d71fd7ffa',
    '17413ea821dd',
    '17591cc08b77',
    '1049859dde22',
    '1fd917b7748b',
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
  for (const [version, { text, rows }] of Object.entries(GOLDEN)) {
    const m = qrMatrix(text)
    expect(m?.length).toBe(17 + 4 * Number(version.slice(1)))
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
