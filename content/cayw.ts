declare const Components: any
declare const Zotero: any

import { XULoki as Loki } from './db/loki.ts'
import { KeyManager } from './key-manager.ts'
import { Formatter } from './cayw/formatter.ts'
import { debug } from './debug.ts'

// tslint:disable:max-classes-per-file

/**
 * The Field class corresponds to a field containing an individual citation
 * or bibliography
 */
class Field {
  public noteIndex = 0
  public doc: Document
  public code: string
  public text: string
  public wrappedJSObject: Field

  constructor(doc) {
    this.doc = doc
    this.code = ''
    // This is actually required and current integration code depends on text being non-empty upon insertion.
    // insertBibliography will fail if there is no placeholder text.
    this.text = '{Placeholder}'
    this.wrappedJSObject = this
  }

  /**
   * Deletes this field and its contents.
   */
  public async delete() { this.doc.fields.filter(field => field !== this) }

  /**
   * Removes this field, but maintains the field's contents.
   */
  public async removeCode() { this.code = '' }

  /**
   * Selects this field.
   */
  public async select() { return 0 }

  /**
   * Sets the text inside this field to a specified plain text string or pseudo-RTF formatted text
   * string.
   * @param {String} text
   * @param {Boolean} isRich
   */
  public async setText(text, isRich) { this.text = text }

  /**
   * Gets the text inside this field, preferably with formatting, but potentially without
   * @returns {String}
   */
  public async getText() { return this.text }

  /**
   * Sets field's code
   * @param {String} code
   */
  public async setCode(code) { this.code = code }

  /**
   * Gets field's code.
   * @returns {String}
   */
  public async getCode() { return this.code }

  /**
   * Returns true if this field and the passed field are actually references to the same field.
   * @param {Field} field
   * @returns {Boolean}
   */
  public async equals(field) { return this === field }

  /**
   * This field's note index, if it is in a footnote or endnote; otherwise zero.
   * @returns {Number}
   */
  public async getNoteIndex() { return 0 }
}

/**
 * The Document class corresponds to a single word processing document.
 */
class Document {
  public fields: Field[]
  public data: any
  public $loki: number

  constructor() {
    this.fields = []
  }

  public async initDoc(options: {style?: string} = {}) {
    options.style = options.style || 'apa'
    const style = Zotero.Styles.get(`http://www.zotero.org/styles/${options.style}`) || Zotero.Styles.get(`http://juris-m.github.io/styles/${options.style}`) || Zotero.Styles.get(options.style)
    debug('CAYW.document:', style)
    options.style = style ? style.url : 'http://www.zotero.org/styles/apa'
    const data = new Zotero.Integration.DocumentData()
    data.prefs = {
      noteType: 0,
      fieldType: 'Field',
      automaticJournalAbbreviations: true,
    }
    data.style = {styleID: options.style, locale: 'en-US', hasBibliography: true, bibliographyStyleHasBeenSet: true}
    data.sessionID = Zotero.Utilities.randomString(10) // tslint:disable-line:no-magic-numbers
    Object.assign(data, options)
    debug('CAYW.document:', data)
    await this.setDocumentData(data.serialize())
  }

  /**
   * Displays a dialog in the word processing application
   * @param {String} dialogText
   * @param {Number} icon - one of the constants defined in integration.js for dialog icons
   * @param {Number} buttons - one of the constants defined in integration.js for dialog buttons
   * @returns {Number}
   *     - Yes: 2, No: 1, Cancel: 0
   *     - Yes: 1, No: 0
   *     - Ok: 1, Cancel: 0
   *     - Ok: 0
   */
  public async displayAlert(dialogText, icon, buttons) { return 0 }

  /**
   * Brings this document to the foreground (if necessary to return after displaying a dialog)
   */
  public async activate() { return 0 }

  /**
   * Determines whether a field can be inserted at the current position.
   * @param {String} fieldType
   * @returns {Boolean}
   */
  public async canInsertField(fieldType) { return true }

  /**
   * Returns the field in which the cursor resides, or NULL if none.
   * @param {String} fieldType
   * @returns {Boolean}
   */
  public async cursorInField(fieldType) { return false }

  /**
   * Get document data property from the current document
   * @returns {String}
   */
  public async getDocumentData() { return this.data }

  /**
   * Set document data property
   * @param {String} data
   */
  public async setDocumentData(data) { this.data = data }

  /**
   * Inserts a field at the given position and initializes the field object.
   * @param {String} fieldType
   * @param {Integer} noteType
   * @returns {Field}
   */
  public async insertField(fieldType, noteType) {
    if (typeof noteType !== 'number') {
      throw new Error('noteType must be an integer')
    }
    const field = new Field(this)
    this.fields.push(field)
    return field
  }

  /**
   * Gets all fields present in the document. The observer will receive notifications for two
   * topics: "fields-progress", with the document as the subject and percent progress as data, and
   * "fields-available", with an nsISimpleEnumerator of fields as the subject and the length as
   * data
   * @param {String} fieldType
   * @param {nsIObserver} observer
   */
  public async getFields(fieldType) {
    return Array.from(this.fields)
  }

  /**
   * Sets the bibliography style, overwriting the current values for this document
   */
  public async setBibliographyStyle(firstLineIndent, bodyIndent, lineSpacing, entrySpacing, tabStops, tabStopsCount) { return 0 }

  /**
   * Converts all fields in a document to a different fieldType or noteType
   * @params {FieldEnumerator} fields
   */
  public async convert(fields, toFieldType, toNoteType, count) { return 0 }

  /**
   * Cleans up the document state and resumes processor for editing
   */
  public async cleanup() { return 0 }

  /**
   * Informs the document processor that the operation is complete
   */
  public async complete() { return 0 }

  /**
   * Gets the citation
   */
  public async citation() {
    debug('async citations', this.fields)
    // const citation = await (new Zotero.Integration.CitationField(this.fields[0], this.fields[0].code)).unserialize()
    const citation = { citationItems: [] }
    if (!citation || !citation.citationItems) return []

    return citation.citationItems.map(item => {
      debug('CAYW.citation:', item)
      return {
        id: item.id,
        locator: item.locator || '',
        suppressAuthor: !!item['suppress-author'],
        prefix: item.prefix || '',
        suffix: item.suffix || '',
        label: item.locator ? (item.label || 'page') : '',
        citekey: KeyManager.get(item.id).citekey,

        uri: Array.isArray(item.uri) ? item.uri[0] : undefined,
        itemType: item.itemData ? item.itemData.type : undefined,
        title: item.itemData ? item.itemData.title : undefined,
      }
    })
  }
}

// export singleton: https://k94n.com/es6-modules-single-instance-pattern
export let Application = new class { // tslint:disable-line:variable-name
  public primaryFieldType = 'Field'
  public secondaryFieldType = 'Bookmark'
  public outputFormat = 'rtf'
  public supportedNotes = ['footnotes', 'endnotes']

  public fields: any[]

  private docs: any
  private active: Document

  constructor() {
    this.fields = [] // what does this do?

    const db = new Loki('cayw', {
      ttl: 60 * 1000, // tslint:disable-line:no-magic-numbers
      ttlInterval: 5 * 60 * 1000, // tslint:disable-line:no-magic-numbers
    })
    this.docs = db.addCollection('cayw', {
      ttl: 60 * 1000, // tslint:disable-line:no-magic-numbers
      ttlInterval: 5 * 60 * 1000, // tslint:disable-line:no-magic-numbers
    })
  }

  /**
   * Gets the active document.
   * @returns {Document}
   */
  public async getActiveDocument() { return this.active }

  /**
   * Gets the document by some app-specific identifier.
   * @param {String|Number} id
   */
  public async getDocument(id) {
    debug('CAYW.getDocument', { id }, this.docs.findOne(id))
    return this.docs.findOne(id)
  }

  public QueryInterface() { return this }

  public async createDocument(options) {
    this.active = new Document()
    await this.active.initDoc(options)
    this.docs.insert(this.active)
    return this.active
  }

  public async closeDocument(doc) {
    this.docs.findAndRemove(doc.$loki)
  }
}

export async function pick(options) {
  await Zotero.BetterBibTeX.ready

  const doc = await Application.createDocument(options)
  await Zotero.Integration.execCommand('BetterBibTeX', 'addEditCitation', doc.$loki)

  const picked = await doc.citation()
  const citation = picked.length ? await Formatter[options.format || 'playground'](picked, options) : ''
  debug('async picks', citation)
  await Application.closeDocument(doc)
  return citation
}

Zotero.Server.Endpoints['/better-bibtex/cayw'] = class {
  public supportedMethods = ['GET']
  public OK = 200
  public SERVER_ERROR = 500

  public async init(request) {
    const options = request.query || {}

    if (options.probe) return [this.OK, 'text/plain', 'ready']

    try {
      const citation = await pick(options)

      if (options.clipboard) Zotero.Utilities.Internal.copyTextToClipboard(citation)

      if (options.minimize) {
        const wm = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator)
        const windows = wm.getEnumerator(null)
        while (windows.hasMoreElements()) {
          const win = windows.getNext().QueryInterface(Components.interfaces.nsIDOMChromeWindow)
          win.minimize()
        }
      }

      debug('CAYW: sending', citation)
      return [this.OK, 'text/plain', citation]
    } catch (err) {
      return [this.SERVER_ERROR, 'application/text', `CAYW failed: ${err}\n${err.stack}`]
    }
  }
}
