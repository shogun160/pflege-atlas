export interface ExportShape {
  exportedAt: string;
  user: Record<string, unknown>;
  submissions: Array<Record<string, unknown>>;
  articles: Array<Record<string, unknown>>;
}

export function shapeExport(args: {
  user: Record<string, unknown>;
  submissions: Array<Record<string, unknown>>;
  articles: Array<Record<string, unknown>>;
}): ExportShape {
  const { password: _password, ...userClean } = args.user;
  void _password;
  return {
    exportedAt: new Date().toISOString(),
    user: userClean,
    submissions: args.submissions,
    articles: args.articles,
  };
}
