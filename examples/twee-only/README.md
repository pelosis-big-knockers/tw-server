# twee-only

The baseline: a single `.twee` file, no scripts or styles.

Because every file in the directory is compilable, `getCompilableFilePaths`
collapses the whole folder to a single directory argument for tweego
(e.g. `tweego -o index.html "." "<scratch>"`).
