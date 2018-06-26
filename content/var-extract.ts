import { debug } from './debug.ts'
import JSON5 = require('json5')

// http://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables
const cslVariables = require('./csl-vars.json')
import * as Citekey from './key-manager/get-set.ts'

function cslCreator(value, type) {
  const name = value.split('||').map(v => v.trim())
  const withType = (type === 'creator' ? 1 : 0)

  if (name.length === (2 + withType)) { // tslint:disable-line:binary-expression-operand-order
    return {
      lastName: name.shift(),
      firstName: name.shift(),
      type: name.shift(),
    }
  }

  if (name.length === (1 + withType)) { // tslint:disable-line:binary-expression-operand-order
    return {
      name: name.shift(),
      type: name.shift(),
    }
  }

  throw new Error(`unparsable '${type}': '${value}'`)
}

export function extract(item) {
  let extra = item.extra || ''

  const extraFields = {
    bibtex: {},
    csl: {},
    kv: {},
    citekey: { citekey: '', pinned: false },
  }

  const citekey = Citekey.get(extra)
  extraFields.citekey = { citekey: citekey.citekey, pinned: citekey.pinned }
  extra = citekey.extra

  extra = extra.replace(/(?:biblatexdata|bibtex|biblatex)(\*)?\[([^\[\]]*)\]/g, (match, cook, fields) => {
    const legacy = {}
    for (const field of fields.split(';')) {
      const kv = field.match(/^([^=]+)(?:=)([\S\s]*)/)
      if (!kv) {
        debug('fieldExtract: not a field', field)
        return match
      }

      let [ , name, value ] = kv.map(v => v.trim())
      name = name.toLowerCase()
      legacy[name] = { name, value, raw: !cook }
    }

    debug('var-extract:', legacy)
    Object.assign(extraFields.bibtex, legacy)
    return ''
  }).trim()

  let m
  // this selects the maximum chunk of text looking like {...}. May be too long, deal with that below
  if (m = /(biblatexdata|bibtex|biblatex)(\*)?({[\s\S]+})/.exec(extra)) {
    let json = null
    const prefix = m[1] + (m[2] || '') // tslint:disable-line:no-magic-numbers
    const raw = !m[2] // tslint:disable-line:no-magic-numbers
    let data = m[3] // tslint:disable-line:no-magic-numbers
    // minimize the chunk
    while (data.indexOf('}') >= 0) {
      try {
        json = JSON5.parse(data)
        break
      } catch (error) { }

      // remove the last '}'
      data = data.replace(/[^}]*}$/, '')
    }

    if (json) {
      extra = extra.replace(prefix + data, '').trim()
      for (let [name, value] of Object.entries(json)) {
        name = name.toLowerCase()
        extraFields.bibtex[name] = {name, value, raw }
      }
    }
  }

  // fetch fields as per https://forums.zotero.org/discussion/3673/2/original-date-of-publication/
  extra = extra.replace(/{:([^:]+):[^\S\n]*([^}]+)}/g, (match, name, value) => {
    name = name.toLowerCase()
    const cslType = cslVariables[name]

    if (!cslType) return match

    if (cslType === 'creator') {
      extraFields.csl[name] = extraFields.csl[name] || { type: cslType, value: [] }
      extraFields.csl[name].value.push(cslCreator(value, cslType))
    } else {
      extraFields.csl[name] = { type: cslType, name, value }
    }

    return ''
  }).trim()

  extra = extra.split('\n').filter(line => {
    let [name, value] = line.split(/\s*:\s*(.+)/)

    if (!value) return true // keep line

    name = name.trim().toLowerCase().replace(/ +/g, '-')
    const cslType = cslVariables[name]
    debug('fieldExtract:', { name, value, cslType })
    try {
      if (name === 'creator' || cslType) {
        if (cslType === 'creator') {
          extraFields.csl[name] = extraFields.csl[name] || { type: cslType, value: [] }
          extraFields.csl[name].value.push(cslCreator(value, cslType || 'creator'))
        } else {
          extraFields.csl[name] = { type: cslType, name, value }
        }

        return false
      }
    } catch (err) {
      debug('failed to parse creator type from', line, err)
    }

    if (['lccn', 'mr', 'zbl', 'arxiv', 'jstor', 'hdl', 'googlebooksid'].includes(name.replace(/-/g, ''))) { // google-books-id
      extraFields.kv[name.replace(/-/g, '')] = value
      return false
    }

    return true
  }).join('\n')

  debug('fieldExtract:', { extra, extraFields })
  return { extra, extraFields }
}
