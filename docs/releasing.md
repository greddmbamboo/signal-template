# Publishing Signal updates

The app checks the public release.json on load and every six hours while open. It also has a manual check. It sends no app records, credentials, or installed version; GitHub still receives ordinary network metadata such as IP address. Failed checks do not block tracking. There is no background task when the app is closed and no automatic installation.

For each stable release:

1. Bump package.json and the root versions in package-lock.json. Use numeric major.minor.patch versions.
2. Document changes, migration requirements, supported upgrade paths, and known limitations. Update UPDATE-SIGNAL.md as necessary.
3. Run npm test and the deployment dry run. Test an upgrade against representative existing data and local customizations when migrations or configuration change.
4. Commit the tested code. Create an immutable vVERSION tag and publish a GitHub release with its notes. Do not move an existing tag.
5. Only after the release and tagged source ZIP are publicly available, update release.json on main to advertise VERSION. Do not advertise drafts, prereleases, or a main-branch commit without a release.
6. Verify the manifest, release notes, and tagged ZIP without authentication.

The first update-aware version is 0.2.0. Earlier installs cannot display update notices until their owners use UPDATE-SIGNAL.md once. Forks and template copies work because the checker uses the original public manifest, regardless of their Git remotes.
