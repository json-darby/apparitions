import argostranslate.package

print("Updating package index...")
argostranslate.package.update_package_index()

available_packages = argostranslate.package.get_available_packages()
print(f"Found {len(available_packages)} available packages.")

nl_to_en = next(
    filter(
        lambda x: x.from_code == 'nl' and x.to_code == 'en', available_packages
    ), None
)

if nl_to_en:
    print(f"Downloading and installing {nl_to_en}...")
    argostranslate.package.install_from_path(nl_to_en.download())
    print("Done!")
else:
    print("Could not find Dutch to English translation package.")
