import { documentBlocks, type AnalysisDocument } from './analysis-document'

export function AnalysisPreview({ document }: { document: AnalysisDocument }) {
  return (
    <article className="analysis-document" aria-label="HawkEye 360 analysis document">
      {documentBlocks(document.markdown).map((block, index) => {
        switch (block.kind) {
          case 'image':
            return (
              <img
                key={index}
                className={block.text === 'HawkEye 360 mark' ? 'analysis-mark' : 'analysis-chart'}
                src={block.src}
                alt={block.text}
              />
            )
          case 'heading':
            return block.depth === 1 ? <h3 key={index}>{block.text}</h3> : <h4 key={index}>{block.text}</h4>
          case 'quote':
            return <blockquote key={index}>{block.text}</blockquote>
          case 'item':
            return (
              <p key={index} className="analysis-item">
                {block.text}
              </p>
            )
          default:
            return <p key={index}>{block.text}</p>
        }
      })}
    </article>
  )
}
