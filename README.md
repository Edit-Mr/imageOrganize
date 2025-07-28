# imageOrganize

Organize photos by EXIF date

* Move **recognized files (with EXIF or mtime date)** into:

  ```
  ./organized/YYYY/MM/filename.ext
  ```

* Move **all other files (no readable date, bad format, broken, etc.)** into:

  ```
  ./organized/unknown/
  ```
