import { onNavigate } from '@violentmonkey/url';
import { BlobWriter, EntryMetaData, HttpOptions, HttpReader, ZipWriter } from "@zip.js/zip.js";
import { saveAs } from 'file-saver';
import debounce from 'lodash/debounce';
import { getModelVersion } from "./civit-api";

const uniqueIdPrefix = `__userscript_civitai-one-click-dl-`
const attributesToCopy = ["class", "type", "data-button", "download"]

const addImageDownloadBtn = async (downloadBtn: HTMLAnchorElement | undefined): Promise<void> => {
  if (!downloadBtn) {
    return
  }

  const parentNode = downloadBtn.parentNode
  if (!parentNode) {
    return
  }

  if (!(parentNode instanceof HTMLDivElement)) {
    return;
  }

  // this is a bit roundabout since we already have the DL images, but this is cleaner
  // than trying to scrape the HTML for the image URLs
  const modelVersionString = downloadBtn.href.match(`\\d+`)?.[0]
  if (!modelVersionString) {
    return
  }

  // dedupe logic
  // dedupe logic so we don't get loads of buttons
  const uniqueId = `${uniqueIdPrefix}${modelVersionString}`
  const existingBtns = document.querySelectorAll(`a[id=${uniqueId}]`)
  if (existingBtns.length > 0) {
    // we have button(s), nothing to do here
    return
  }

  // ok now we can make the button
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
    downloadWithImagesTextDiv.innerText = "Download Images as Zip"
  }

  const modelVersion = parseInt(modelVersionString)
  const modelVersionRes = await getModelVersion(modelVersion)

  // TODO can there ever be more than 1 model file? who knows
  // const modelName = modelVersionRes.modelName.replace(" ", "_");
  // const downloadUrl = modelVersionRes.downloadUrl
  const modelName = modelVersionRes.files[0].name
  // const downloadUrl = modelVersionRes.files[0].downloadUrl
  const imageUrls = modelVersionRes.images.map((image) => {
    // image URLs by default will resize and lose metadata
    // update the URL to the original size to get that metadata

    const originalWidth = image.width
    const imageUrl = image.url.replace(/width=\d+/, `width=${originalWidth}`)
    return imageUrl
  })

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

    const downloadPromises = [] as Promise<EntryMetaData>[]
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

  // for dedupe logic
  downloadWithImagesBtn.id = uniqueId;

  // insert button to HTML
  parentNode.appendChild(downloadWithImagesBtn)

  // see https://github.com/tehrobber/civitai-one-click-dl/issues/3
  parentNode.style.flexFlow = "wrap"
}

const addButtons = async () => {
  const url = window.location.href

  // validations/safety-checks
  if (!url || !url.includes(`models/`)) {
    return
  }

  let downloadLatestButton: HTMLAnchorElement | undefined
  const downloadVersionButtons: HTMLAnchorElement[] = []

  // TODO this is a fallback, in case the previous method breaks
  // const allLinks = document.querySelectorAll<HTMLAnchorElement>(`a[href]`);
  // allLinks.forEach((link) => {
  //    if (link.href.includes('api/download')) { console.log(link) }
  // })

  // pull out the buttons
  // luckily they WERE labeled in CivitAI with a `download` property
  // document.querySelectorAll<HTMLAnchorElement>(`a[download]`).forEach((link) => {
  document.querySelectorAll<HTMLAnchorElement>(`a[href^="/api/download"]`).forEach((link) => {
    // allDownloadLinks.push(link);

    // link that contains "Latest" is the main DL button
    if (link.innerText.includes("Latest")) {
      downloadLatestButton = link
    } else {
      downloadVersionButtons.push(link)
    }
  })

  const addBtnPromises = [addImageDownloadBtn(downloadLatestButton)]
  for (const downloadVersionButton of downloadVersionButtons) {
    addBtnPromises.push(addImageDownloadBtn(downloadVersionButton))
  }
  await Promise.all(addBtnPromises)
}

const debouncedAddImages = debounce(
  addButtons,
  100, // ms, so 0.2 seconds
  { leading: false, trailing: true }
)

// After DOM is built, but before images/other assets are loaded
// see https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event
window.addEventListener("DOMContentLoaded", debouncedAddImages)

// because NextJS's router is garbage and doesn't fire web standard methods,
// we watch the `main` element for any changes
// this is why we have dedupe logic and conditional logic

// see https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver 
const observer = new MutationObserver(debouncedAddImages)
window.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(`main`).forEach((mainElement) => {
    observer.observe(mainElement, { attributes: false, childList: true, subtree: true })
  })
})

// see https://www.npmjs.com/package/@violentmonkey/url
onNavigate(debouncedAddImages)
debouncedAddImages();
