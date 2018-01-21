declare const Components: any

import format = require('string-template')

import { debug } from './debug.ts'

const stringBundleService = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService)
const stringBundle = stringBundleService.createBundle('chrome://zotero-better-bibtex/locale/zotero-better-bibtex.properties')

export function getString(id, params = null) {
  try {
    return params ? format(stringBundle.GetStringFromName(id), params) : stringBundle.GetStringFromName(id)
  } catch (err) {
    debug('getString', id, err)
    return id
  }
}
