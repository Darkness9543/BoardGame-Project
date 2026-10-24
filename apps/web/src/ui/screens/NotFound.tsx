export function NotFound({ path }: { readonly path: string }) {
  return (
    <main className="screen screen-center">
      <div className="card">
        <h1 className="display">Nothing here</h1>
        <p className="muted">
          The address <code>#{path}</code> doesn't lead anywhere. If it was an invite, the game may have ended or the link is incomplete.
        </p>
        <a className="btn btn-primary" href="#/">
          Main menu
        </a>
      </div>
    </main>
  )
}
