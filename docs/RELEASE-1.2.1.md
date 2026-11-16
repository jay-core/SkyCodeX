<img src="../assets/icon/skycodex-1024.png" width="112" alt="SkyCodeX icon">

# SkyCodeX 1.2.1

**Fixes on top of 1.2: safer saving and listing, fewer false findings, and quieter scroll bars.**

## Fixed

- **Saving through a symbolic link** changes the file it points to and keeps the link, instead of replacing the link with a copy.
- **Linked folders** are listed as folders and are not walked into, so a link that points back up the tree can't loop the file listing.
- **A member called `lock()`** counts as taking a lock only when it is called on a mutex type, not on a `weak_ptr` or anything else with a `lock()` method.
- **Library calls in the card** ignore `/* block comments */`, as they already ignored line comments and strings.
- **Starting a process:** `.start(` on its own no longer counts as starting one; `QProcess::start` and the rest still do.
- **A shared walk that is not well formed** is refused instead of stopping with an error.
- **Build folders** are recognised by name more precisely: `build`, `out`, either with a suffix (`build-debug`, `out.x64`), or `cmake-build-*`; `builder`, `output` and `outline` are no longer taken for build folders.
- **Entry ranking** no longer treats a folder called `example_build` differently from any other.
- **Comparing with a commit** accepts only commit ids.
- **Language packs:** two installs can no longer start at the same moment.
- **Settings file watcher:** an error while watching is logged instead of left unhandled.
- **Test-only code** (the smoke harness and its window handlers) is loaded and answers only in test runs.

## Changed

- **Scroll bars:** no horizontal scroll bars; vertical ones show only while you scroll. Content still scrolls sideways with a trackpad or Shift and the wheel.
- **Old names dropped:** the automatic fix of the old "ARX F1" font name is gone, and packs installed under the old `lithograph-pack.json` manifest name are no longer listed. Reinstall such a pack from the compiler window.

## Checked

The same unit tests on all three systems (281, including 8 new ones in `src/tests/sweepfixes.test.ts`) and a start-up check of each packaged build on the sample project. Symlink saving, commit comparison, pack installs and malformed walks are covered by unit tests or code reading, not by an app run. The scroll-bar fade was checked at rest, not in motion.

## Downloads

| System | File |
|---|---|
| macOS 13+, Apple silicon | `SkyCodeX-1.2.1-mac-arm64.zip` |
| Linux x64 (Ubuntu 22.04+) | `SkyCodeX-1.2.1-linux-x64.tar.gz` |
| Windows 10/11, x64 | `SkyCodeX-1.2.1-win-x64.zip` |

The builds are not signed with a paid certificate:
- **macOS:** *System Settings → Privacy & Security → Open Anyway*.
- **Windows:** SmartScreen → *More info → Run anyway*.
- **Linux:** see *Read me first.txt* in the folder.

What is still open from 1.2 is listed in [RELEASE-1.2.md](RELEASE-1.2.md).
