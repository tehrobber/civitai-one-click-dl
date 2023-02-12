import { BlobWriter, ZipWriter, HttpReader, HttpOptions } from "@zip.js/zip.js"
import { saveAs } from 'file-saver'
import { getModelVersion } from "./civit-api"

const attributesToCopy = ["class", "type", "data-button", "download"]

const addImageDownloadBtn = async (downloadBtn?: HTMLAnchorElement) => {
  if (downloadBtn) {
    const downloadWithImagesBtn = document.createElement("a")
    downloadWithImagesBtn.innerText = "Download with Images"

    for (const attr of attributesToCopy) {
      const attrValue = downloadBtn.getAttribute(attr)
      if (attrValue) {
        downloadWithImagesBtn.setAttribute(attr, attrValue)
      }
    }

    downloadWithImagesBtn.innerHTML = downloadBtn.innerHTML

    let downloadWithImagesTextDiv: HTMLDivElement | undefined;
    downloadWithImagesBtn.querySelectorAll(`div`).forEach((div) => {
      if (div.innerText.includes("Download")) {
        downloadWithImagesTextDiv = div;
      }
    })

    if (downloadWithImagesTextDiv) {
      // const fileSize = downloadLatestWithImagesTextDiv.innerText.match(`(.*?)`)?.[0]

      downloadWithImagesTextDiv.innerText = "Download Images as Zip"
    }

    // this is a bit roundabout since we already have the DL images, but this is cleaner
    // than trying to scrape the HTML for the image URLs
    const modelVersionString = downloadBtn.href.match(`\\d+`)?.[0]

    if (modelVersionString) {
      const modelVersion = parseInt(modelVersionString)

      const modelVersionRes = await getModelVersion(modelVersion)

      // TODO can there ever be more than 1 model file? who knows
      // const modelName = modelVersionRes.modelName.replace(" ", "_");
      // const downloadUrl = modelVersionRes.downloadUrl
      const modelName = modelVersionRes.files[0].name
      // const downloadUrl = modelVersionRes.files[0].downloadUrl
      const imageUrls = modelVersionRes.images.map((image) => image.url)

      const modelNameNoExt = modelName.split(".").slice(0, -1).join(".")

      const handleClick = async () => {
        // create ZIP with all images/model
        const blobWriter = new BlobWriter(`application/zip`)
        const zipWriter = new ZipWriter(blobWriter)

        // const httpHeaders = new Map();
        // httpHeaders.set('Sec-Fetch-Site', 'none')
        const httpOptions: HttpOptions = {
          preventHeadRequest: true,
          useXHR: true,
          // headers: httpHeaders
        }

        const downloadPromises = []
        // TODO CORS says no for now
        // downloadPromises.push(zipWriter.add(modelName, new HttpReader(downloadUrl, httpOptions)))

        for (let idx = 0; idx < imageUrls.length; idx++) {
          const imageUrl = imageUrls[idx]

          const httpReader = new HttpReader(imageUrl, httpOptions)
          downloadPromises.push(zipWriter.add(`${modelNameNoExt}${idx === 0 ? "" : `.${idx}`}.preview.png`, httpReader))
        }

        await Promise.all(downloadPromises)

        // TODO check this cast
        const blob = (await zipWriter.close(undefined, {})) as Blob

        // TODO is there a better way to do this for a better UX?
        // document.location.assign(blobUrl)
        saveAs(blob, `${modelNameNoExt}_images.zip`)
      }

      downloadWithImagesBtn.onclick = handleClick
    }

    // insert button to HTML
    downloadBtn.parentNode?.appendChild(downloadWithImagesBtn)
  }
}

const addButtons = async () => {
  const url = window.location.href

  // validations/safety-checks
  if (!url || !url.includes(`models/`)) {
    return
  }

  let downloadLatestButton: HTMLAnchorElement | undefined
  let downloadVersionButton: HTMLAnchorElement | undefined

  // TODO this is a fallback, in case the previous method breaks
  // const allLinks = document.querySelectorAll<HTMLAnchorElement>(`a[href]`);
  // allLinks.forEach((link) => {
  //    if (link.href.includes('api/download')) { console.log(link) }
  // })

  // pull out the buttons
  // luckily they are labeled in CivitAI with a `download` property
  document.querySelectorAll<HTMLAnchorElement>(`a[download]`).forEach((link) => {
    // allDownloadLinks.push(link);

    // link that contains "Latest" is the main DL button
    if (link.innerText.includes("Latest")) {
      downloadLatestButton = link
    } else {
      downloadVersionButton = link
    }
  })

  addImageDownloadBtn(downloadLatestButton)
  addImageDownloadBtn(downloadVersionButton)
}

// After DOM is built, but before images/other assets are loaded
// see https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event
document.addEventListener("DOMContentLoaded", addButtons)
