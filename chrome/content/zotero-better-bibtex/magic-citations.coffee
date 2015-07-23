BetterBibTeX_MagicCitations = new class
  onLoad: ->
    @deferred = window.arguments[0].wrappedJSObject
    @result = ''
    search = document.getElementById('zotero-better-bibtex-search-citation')
    search.value = ''
    @refresh()
    window.sizeToContent()

  onClosing: ->
    @deferred.resolve(@result)
    return true

  onAccept: ->
    results = document.getElementById('zotero-better-bibtex-found-citations')
    @result = (selected.value for selected in results.selectedItems).join(',')
    Zotero.Utilities.Internal.copyTextToClipboard(@result)
    return true

  onCancel: ->
    return true

  refresh: ->
    results = document.getElementById('zotero-better-bibtex-found-citations')
    results.removeChild(node) for node in results.children

    style = Zotero.Styles.get('http://www.zotero.org/styles/apa')
    cslEngine = style.getCiteProc(Zotero.Prefs.get('export.quickCopy.locale'))

    search = document.getElementById('zotero-better-bibtex-search-citation')
    value = search.value.toLowerCase()
    if value && value != ''
      # replace with proper search
      s = new Zotero.Search()
      value = value.replace(' & ', ' ', 'g').replace(' and ', ' ', 'g')
      s.addCondition('quicksearch-titleCreatorYear', 'contains', value)
      s.addCondition('itemType', 'isNot', 'attachment')
      s.addCondition('itemType', 'isNot', 'note')
      items = s.search()

      for id in items
        html = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, [Zotero.Items.get(id)], 'html')
        new @HTML(results, Zotero.BetterBibTeX.keymanager.get({itemID: id}).citekey, html)
    window.sizeToContent()

  HTML: class
    constructor: (rlb, id, html) ->
      rli = document.createElement('richlistitem')
      rli.value = id
      rlb.appendChild(rli)

      @stack = [rli]
      @HTMLtoDOM.Parser(html, @)

    start: (tag, attrs, unary) ->
      tag = tag.toLowerCase()
      elt = document.createElementNS('http://www.w3.org/1999/xhtml', tag)
      for attr in attrs
        elt.setAttribute(attr.name.toLowerCase(), attr.value)

      @stack[0].appendChild(elt)
      @stack.unshift(elt) unless unary

    end: (tag) ->
      @stack.shift()

    cdata: (text) ->
      @stack[0].appendChild(document.createTextNode(text))

    chars: (text) ->
      @stack[0].appendChild(document.createTextNode(text))

Components.utils.import('resource://zotero-better-bibtex/translators/htmlparser.js', BetterBibTeX_MagicCitations.HTML::)
