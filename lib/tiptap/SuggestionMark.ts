import { Mark } from '@tiptap/core'

export const SuggestionMark = Mark.create({
  name: 'suggestion',

  attrs: {
    suggestionId: {
      default: null,
      parseHTML: element => (element as HTMLElement).getAttribute('data-suggestion-id'),
    },
    severity: {
      default: 'medium',
      parseHTML: element => (element as HTMLElement).getAttribute('data-severity') || 'medium',
    },
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-suggestion-id]',
        getAttrs: (node) => {
          const element = node as HTMLElement
          return {
            suggestionId: element.getAttribute('data-suggestion-id'),
            severity: element.getAttribute('data-severity') || 'medium',
          }
        },
      },
    ]
  },

  renderHTML(props) {
    const { mark } = props
    const severity = mark.attrs.severity || 'medium'
    const suggestionId = mark.attrs.suggestionId

    console.log('SuggestionMark renderHTML - suggestionId:', suggestionId, 'severity:', severity, 'full attrs:', JSON.stringify(mark.attrs))

    return [
      'span',
      {
        'data-suggestion-id': suggestionId,
        'data-severity': severity,
        'class': `suggestion-highlight suggestion-${severity}`,
      }
    ]
  },
})
