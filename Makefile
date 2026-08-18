# Build the distributable assets (see scripts/build.py). stdlib only.
.PHONY: dist pyz skills clean

dist:       ## Build both assets into dist/
	python3 scripts/build.py all

pyz:        ## Build just the pmview.pyz zipapp
	python3 scripts/build.py pyz

skills:     ## Build just the gw-skills tarball
	python3 scripts/build.py skills

clean:      ## Remove build output
	rm -rf dist
