data "external_schema" "drizzle" {
  program = ["pnpm", "exec", "drizzle-kit", "export"]
}

env "local" {
  dev = "sqlite://file?mode=memory&_fk=1"
  schema {
    src = data.external_schema.drizzle.url
  }
  migration {
    dir = "file://atlas/migrations"
  }
}
