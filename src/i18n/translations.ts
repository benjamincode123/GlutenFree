export type Locale = 'en' | 'nb';

type TranslationKey =
  | 'nav.scanner'
  | 'nav.result'
  | 'nav.add'
  | 'nav.products'
  | 'nav.profile'
  | 'nav.settings'
  | 'nav.admin'
  | 'nav.leaderboard'
  | 'nav.signIn'
  | 'common.loading'
  | 'common.guest'
  | 'common.admin'
  | 'common.member'
  | 'common.level'
  | 'common.back'
  | 'common.close'
  | 'common.saving'
  | 'common.cancel'
  | 'common.delete'
  | 'common.unknownError'
  | 'common.goBack'
  | 'common.closeKeyboard'
  | 'common.done'
  | 'errors.network'
  | 'errors.unavailable'
  | 'errors.unauthorized'
  | 'errors.forbidden'
  | 'errors.notFound'
  | 'errors.invalidCredentials'
  | 'errors.usernameTaken'
  | 'errors.barcodeTaken'
  | 'errors.productHasBarcode'
  | 'errors.validation'
  | 'errors.searchTooShort'
  | 'errors.imageInvalid'
  | 'errors.lookupFailed'
  | 'errors.searchFailed'
  | 'errors.saveFailed'
  | 'errors.reportFailed'
  | 'errors.loginFailed'
  | 'errors.registerFailed'
  | 'errors.conflict'
  | 'errors.rateLimited'
  | 'errors.generic'
  | 'errors.startup'
  | 'rating.glutenFree'
  | 'rating.glutenFreeDesc'
  | 'rating.glutenTrace'
  | 'rating.glutenTraceDesc'
  | 'rating.glutenContent'
  | 'rating.glutenContentDesc'
  | 'settings.theme'
  | 'settings.themeHint'
  | 'settings.light'
  | 'settings.dark'
  | 'settings.language'
  | 'settings.languageHint'
  | 'settings.norwegian'
  | 'settings.english'
  | 'settings.productCountry'
  | 'settings.productCountryHint'
  | 'country.no'
  | 'country.se'
  | 'country.dk'
  | 'country.de'
  | 'settings.allergens'
  | 'settings.allergensHint'
  | 'settings.about'
  | 'settings.aboutBody'
  | 'settings.disclaimer'
  | 'settings.disclaimerBody'
  | 'scanner.disclaimer'
  | 'settings.scanning'
  | 'settings.scanningBody'
  | 'settings.dataSource'
  | 'settings.dataRemote'
  | 'settings.dataLocal'
  | 'settings.adminNote'
  | 'scanner.checkingPermission'
  | 'scanner.holdToScan'
  | 'scanner.scanning'
  | 'scanner.holdA11y'
  | 'scanner.cameraNeeded'
  | 'scanner.cameraHint'
  | 'scanner.grantCamera'
  | 'scanner.simulatorNote'
  | 'scanner.lastScanned'
  | 'scanner.addProduct'
  | 'scanner.searchProducts'
  | 'scanner.profile'
  | 'scanner.settings'
  | 'scanner.leaderboard'
  | 'leaderboard.subtitle'
  | 'leaderboard.day'
  | 'leaderboard.week'
  | 'leaderboard.month'
  | 'leaderboard.updated'
  | 'leaderboard.empty'
  | 'leaderboard.you'
  | 'leaderboard.anonymous'
  | 'profile.account'
  | 'profile.signedInApi'
  | 'profile.localMode'
  | 'profile.logOut'
  | 'profile.xp'
  | 'profile.xpProgress'
  | 'profile.xpToNext'
  | 'profile.xpMaxLevel'
  | 'profile.xpHistory'
  | 'profile.xpHistoryEmpty'
  | 'profile.xpReasonBarcode'
  | 'profile.xpReasonSubmission'
  | 'profile.xpReasonWrongInfo'
  | 'profile.xpReasonOther'
  | 'profile.privacy'
  | 'profile.anonymousTitle'
  | 'profile.anonymousHint'
  | 'profile.favorites'
  | 'profile.lists'
  | 'profile.changePhoto'
  | 'profile.photoUpdating'
  | 'profile.photoError'
  | 'favorites.title'
  | 'favorites.searchPlaceholder'
  | 'favorites.empty'
  | 'favorites.noneMatch'
  | 'favorites.loading'
  | 'lists.title'
  | 'lists.myLists'
  | 'lists.sharedLists'
  | 'lists.create'
  | 'lists.namePlaceholder'
  | 'lists.emptyMine'
  | 'lists.emptyShared'
  | 'lists.emptyProducts'
  | 'lists.products'
  | 'lists.productCount'
  | 'lists.ownedBy'
  | 'lists.sharedWith'
  | 'lists.sharedWithCount'
  | 'lists.share'
  | 'lists.shareTitle'
  | 'lists.shareUsernamePlaceholder'
  | 'lists.addToList'
  | 'lists.addedToList'
  | 'lists.noListsYet'
  | 'lists.createAndAdd'
  | 'lists.deleteTitle'
  | 'lists.deleteBody'
  | 'lists.removeItemTitle'
  | 'lists.removeItemBody'
  | 'lists.removeItemConfirm'
  | 'lists.notFound'
  | 'result.addFavorite'
  | 'result.removeFavorite'
  | 'admin.subtitle'
  | 'admin.empty'
  | 'admin.tabProducts'
  | 'admin.tabImages'
  | 'admin.tabWrongInfo'
  | 'admin.imagesSubtitle'
  | 'admin.wrongInfoSubtitle'
  | 'admin.imagesEmpty'
  | 'admin.wrongInfoEmpty'
  | 'admin.wrongInfoEmne'
  | 'admin.wrongInfoComment'
  | 'admin.wrongInfoProductMissing'
  | 'admin.wrongInfoEditHint'
  | 'admin.saveAndResolve'
  | 'admin.dismiss'
  | 'admin.catalog'
  | 'admin.name'
  | 'admin.produsent'
  | 'admin.barcode'
  | 'admin.submittedBy'
  | 'admin.submittedAt'
  | 'admin.ingredients'
  | 'admin.glutenRating'
  | 'admin.editHint'
  | 'admin.nameRequired'
  | 'admin.viewImage'
  | 'admin.approve'
  | 'admin.deny'
  | 'admin.prev'
  | 'admin.next'
  | 'admin.pageOf'
  | 'admin.open'
  | 'login.subtitleSignIn'
  | 'login.subtitleRegister'
  | 'login.username'
  | 'login.password'
  | 'login.email'
  | 'login.phone'
  | 'login.plan'
  | 'login.planMonthly'
  | 'login.planYearly'
  | 'login.paymentLinkSent'
  | 'login.sendPaymentLink'
  | 'login.continue'
  | 'login.back'
  | 'login.step1Title'
  | 'login.step2Title'
  | 'login.stepOf'
  | 'login.usernamePlaceholder'
  | 'login.passwordPlaceholder'
  | 'login.showPassword'
  | 'login.hidePassword'
  | 'login.emailPlaceholder'
  | 'login.phonePlaceholder'
  | 'login.signIn'
  | 'login.createAccount'
  | 'login.haveAccount'
  | 'login.noAccount'
  | 'login.register'
  | 'login.registerOpenFailed'
  | 'login.note'
  | 'login.usernameShort'
  | 'login.passwordShort'
  | 'login.emailInvalid'
  | 'login.phoneInvalid'
  | 'login.smsCode'
  | 'login.smsCodePlaceholder'
  | 'login.sendSms'
  | 'login.resendSms'
  | 'login.smsCodeRequired'
  | 'login.genericError'
  | 'login.poweredBy'
  | 'products.searchLabel'
  | 'products.searchPlaceholder'
  | 'products.hint'
  | 'products.recentTitle'
  | 'products.results'
  | 'products.resultOne'
  | 'products.empty'
  | 'products.barcodeUnknown'
  | 'products.searchFailed'
  | 'products.prevPage'
  | 'products.nextPage'
  | 'products.pageLabel'
  | 'products.resultsProgress'
  | 'result.barcode'
  | 'result.scannedBarcode'
  | 'result.lookingUp'
  | 'result.errorTitle'
  | 'result.lookupFailed'
  | 'result.productImageA11y'
  | 'result.country'
  | 'result.allergenWarnTitle'
  | 'result.allergenContains'
  | 'result.allergenMayContain'
  | 'result.allergenBadgeContains'
  | 'result.allergenBadgeMayContain'
  | 'result.ingredients'
  | 'result.noIngredients'
  | 'result.reportBarcode'
  | 'result.reportWrongInfo'
  | 'result.signInToReportWrongInfo'
  | 'result.wrongInfoEmne'
  | 'result.wrongInfoEmnePlaceholder'
  | 'result.wrongInfoComment'
  | 'result.wrongInfoCommentPlaceholder'
  | 'result.wrongInfoSubmit'
  | 'result.wrongInfoEmneShort'
  | 'result.wrongInfoCommentShort'
  | 'result.wrongInfoSent'
  | 'result.reportHint'
  | 'result.signInToReport'
  | 'result.enterBarcode'
  | 'result.scanBarcode'
  | 'result.photoOptional'
  | 'result.photoLocked'
  | 'result.addPhoto'
  | 'result.changePhoto'
  | 'result.removePhoto'
  | 'result.submitPhoto'
  | 'result.photoPending'
  | 'result.photoSaved'
  | 'result.addPhotoHint'
  | 'result.signInToAddPhoto'
  | 'result.submitBarcode'
  | 'result.reportPending'
  | 'result.reportSaved'
  | 'result.reportFailed'
  | 'result.barcodeAlreadyLinked'
  | 'result.editProduct'
  | 'result.notFound'
  | 'result.notFoundAdmin'
  | 'result.notFoundUser'
  | 'result.notFoundGuest'
  | 'result.addOrLink'
  | 'add.signInRequired'
  | 'add.signInRequiredBody'
  | 'add.adminRequired'
  | 'add.adminRequiredBody'
  | 'add.editTitle'
  | 'add.addTitle'
  | 'add.editSubtitle'
  | 'add.addSubtitleAdmin'
  | 'add.addSubtitleUser'
  | 'add.barcode'
  | 'add.barcodePlaceholder'
  | 'add.barcodeFromScan'
  | 'add.linkTitle'
  | 'add.linkHint'
  | 'add.searchName'
  | 'add.glutenFree'
  | 'add.containsGluten'
  | 'add.unknownBarcode'
  | 'add.noMatch'
  | 'add.photoOptional'
  | 'add.photoRequired'
  | 'add.photoRequiredBody'
  | 'add.photoLocked'
  | 'add.noPhoto'
  | 'add.addPhoto'
  | 'add.changePhoto'
  | 'add.removePhoto'
  | 'add.linking'
  | 'add.linkButton'
  | 'add.orCreate'
  | 'add.newSubmission'
  | 'add.produsent'
  | 'add.produsentPlaceholder'
  | 'add.productName'
  | 'add.namePlaceholder'
  | 'add.ingredients'
  | 'add.ingredientsPlaceholder'
  | 'add.glutenRating'
  | 'add.allergens'
  | 'add.allergensHint'
  | 'add.allergenContains'
  | 'add.allergenMayContain'
  | 'add.allergenFree'
  | 'add.saving'
  | 'add.saveChanges'
  | 'add.saveNew'
  | 'add.submitReview'
  | 'add.missingBarcode'
  | 'add.missingBarcodeBody'
  | 'add.missingPhotoBody'
  | 'add.pickProduct'
  | 'add.pickProductBody'
  | 'add.submittedTitle'
  | 'add.submittedBody'
  | 'add.submittedBarcodeBody'
  | 'add.linkedTitle'
  | 'add.linkedBody'
  | 'add.couldNotLink'
  | 'add.missingName'
  | 'add.missingNameBody'
  | 'add.missingRating'
  | 'add.missingRatingBody'
  | 'add.savedTitle'
  | 'add.savedUpdated'
  | 'add.savedAdded'
  | 'add.couldNotSave';

const en: Record<TranslationKey, string> = {
  'nav.scanner': 'AltUten',
  'nav.result': 'Scan Result',
  'nav.add': 'Add Product',
  'nav.products': 'Search Products',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'nav.admin': 'Admin',
  'nav.leaderboard': 'Leaderboard',
  'nav.signIn': 'Sign In',
  'common.loading': 'Loading...',
  'common.guest': 'Guest',
  'common.admin': 'Admin',
  'common.member': 'Member',
  'common.level': 'Level',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.saving': 'Saving...',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.unknownError': 'Unknown error.',
  'common.goBack': 'Go back',
  'common.closeKeyboard': 'Close keyboard',
  'common.done': 'Done',
  'errors.network': 'Could not connect. Check your internet connection and try again.',
  'errors.unavailable': 'The service is temporarily unavailable. Please try again later.',
  'errors.unauthorized': 'Please sign in to continue.',
  'errors.forbidden': 'You do not have permission to do that.',
  'errors.notFound': 'We could not find what you were looking for.',
  'errors.invalidCredentials': 'Wrong username or password.',
  'errors.usernameTaken': 'That username is already in use. Try another one.',
  'errors.barcodeTaken': 'This barcode is already linked to another product.',
  'errors.productHasBarcode': 'This product already has a barcode.',
  'errors.validation': 'Please check what you entered and try again.',
  'errors.searchTooShort': 'Type at least 4 characters to search.',
  'errors.imageInvalid': 'That photo could not be used. Try another one.',
  'errors.lookupFailed': 'Could not look up this product. Please try again.',
  'errors.searchFailed': 'Could not search right now. Please try again.',
  'errors.saveFailed': 'Could not save. Please try again.',
  'errors.reportFailed': 'Could not submit the barcode. Please try again.',
  'errors.loginFailed': 'Could not sign in. Please try again.',
  'errors.registerFailed': 'Could not create the account. Please try again.',
  'errors.conflict': 'That action could not be completed because of a conflict.',
  'errors.rateLimited': 'Please wait {seconds} seconds before refreshing again.',
  'errors.generic': 'Something went wrong. Please try again.',
  'errors.startup': 'The app could not start. Please try again.',
  'rating.glutenFree': 'Gluten Free',
  'rating.glutenFreeDesc': 'Confirmed gluten free.',
  'rating.glutenTrace': 'May Contain Traces',
  'rating.glutenTraceDesc': 'Made with or near gluten-containing foods.',
  'rating.glutenContent': 'With Gluten',
  'rating.glutenContentDesc': 'This product contains gluten.',
  'settings.theme': 'Theme',
  'settings.themeHint': 'Switch between light and dark appearance.',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.language': 'Language',
  'settings.languageHint': 'Choose Norwegian or English.',
  'settings.norwegian': 'Norwegian',
  'settings.english': 'English',
  'settings.productCountry': 'Product countries',
  'settings.productCountryHint':
    'Select one or more countries to search and scan. Tap to toggle.',
  'country.no': 'Norway',
  'country.se': 'Sweden',
  'country.dk': 'Denmark',
  'country.de': 'Germany',
  'settings.allergens': 'Allergen warnings',
  'settings.allergensHint':
    'Choose allergens you want to be warned about when a product contains them or may contain them.',
  'settings.about': 'About',
  'settings.aboutBody':
    'AltUten looks up grocery barcodes in the product catalog (ingredients, allergens, and origin when available).',
  'settings.disclaimer': 'Disclaimer',
  'settings.disclaimerBody':
    'Product information may be incomplete or incorrect. We cannot take responsibility if anyone — including people with severe allergies — is harmed by relying on this app. Always check the product packaging yourself, and seek medical advice when needed.',
  'scanner.disclaimer':
    'Info may be wrong or incomplete. We accept no responsibility for allergic reactions or other harm. Always verify the packaging.',
  'settings.scanning': 'Scanning',
  'settings.scanningBody':
    'Hold the round scan button on the camera screen to activate barcode detection. Release to stop scanning.',
  'settings.dataSource': 'Data source',
  'settings.dataRemote': 'Products are loaded from the remote API / Azure SQL database.',
  'settings.dataLocal': 'Products are stored in the local SQLite database on this device.',
  'settings.adminNote': 'You are signed in with admin access.',
  'scanner.checkingPermission': 'Checking camera permission...',
  'scanner.holdToScan': 'Hold to scan',
  'scanner.scanning': 'Scanning…',
  'scanner.holdA11y': 'Hold to scan barcode',
  'scanner.cameraNeeded': 'Camera access needed',
  'scanner.cameraHint': 'Grant camera access to scan grocery barcodes.',
  'scanner.grantCamera': 'Grant camera access',
  'scanner.simulatorNote': 'The iOS Simulator has no camera. Test on a physical device.',
  'scanner.lastScanned': 'Last scanned barcode',
  'scanner.addProduct': '+ Add product',
  'scanner.searchProducts': 'Search products',
  'scanner.profile': 'Profile',
  'scanner.settings': 'Settings',
  'scanner.leaderboard': 'Leaderboard',
  'leaderboard.subtitle': 'Top 100 Contributors',
  'leaderboard.day': 'Day',
  'leaderboard.week': 'Week',
  'leaderboard.month': 'Month',
  'leaderboard.updated': 'Updated',
  'leaderboard.empty': 'No XP gains in this period yet.',
  'leaderboard.you': 'you',
  'leaderboard.anonymous': 'Anonymous',
  'profile.account': 'Account',
  'profile.signedInApi': 'Signed in to AltUten.',
  'profile.localMode': 'Local mode — no remote account required.',
  'profile.logOut': 'Log out',
  'profile.xp': 'XP',
  'profile.xpProgress': 'Level {level}',
  'profile.xpToNext': '{remaining} XP to level up',
  'profile.xpMaxLevel': 'Max level reached',
  'profile.xpHistory': 'XP history',
  'profile.xpHistoryEmpty': 'No XP earned yet. Report barcodes to earn rewards.',
  'profile.xpReasonBarcode': 'Barcode report applied{detail}',
  'profile.xpReasonSubmission': 'Product submission applied{detail}',
  'profile.xpReasonWrongInfo': 'Wrong-info report approved{detail}',
  'profile.xpReasonOther': 'XP reward',
  'profile.privacy': 'Leaderboard privacy',
  'profile.anonymousTitle': 'Appear as anonymous',
  'profile.anonymousHint':
    'When enabled, the leaderboard hides your username and shows you as anonymous.',
  'profile.favorites': 'Favorite products',
  'profile.lists': 'Lists',
  'profile.changePhoto': 'Change profile photo',
  'profile.photoUpdating': 'Updating photo…',
  'profile.photoError': 'Could not update profile photo.',
  'favorites.title': 'Favorites',
  'favorites.searchPlaceholder': 'Search favorites…',
  'favorites.empty': 'No favorite products yet. Add some from a product page.',
  'favorites.noneMatch': 'No favorites match your search.',
  'favorites.loading': 'Loading favorites…',
  'lists.title': 'Lists',
  'lists.myLists': 'My lists',
  'lists.sharedLists': 'Shared lists',
  'lists.create': 'New list',
  'lists.namePlaceholder': 'List name',
  'lists.emptyMine': 'No lists yet. Create one to get started.',
  'lists.emptyShared': 'No lists have been shared with you yet.',
  'lists.emptyProducts': 'This list has no products yet.',
  'lists.products': 'products',
  'lists.productCount': '{count} products',
  'lists.ownedBy': 'By {username}',
  'lists.sharedWith': 'Shared with',
  'lists.sharedWithCount': 'shared with {count}',
  'lists.share': 'Share',
  'lists.shareTitle': 'Share “{name}”',
  'lists.shareUsernamePlaceholder': 'Username to share with',
  'lists.addToList': 'Add to list',
  'lists.addedToList': 'Added to list',
  'lists.noListsYet': 'You have no lists yet. Create one below.',
  'lists.createAndAdd': 'Create and add',
  'lists.deleteTitle': 'Delete list?',
  'lists.deleteBody': 'Delete “{name}”? This cannot be undone.',
  'lists.removeItemTitle': 'Remove from list?',
  'lists.removeItemBody': 'Do you want to remove “{name}” from the list?',
  'lists.removeItemConfirm': 'Remove',
  'lists.notFound': 'List not found.',
  'result.addFavorite': 'Add to favorites',
  'result.removeFavorite': 'Remove from favorites',
  'admin.subtitle': 'Review pending product submissions. Approve adds them to the catalog.',
  'admin.empty': 'No pending product submissions.',
  'admin.tabProducts': 'Products',
  'admin.tabImages': 'Images',
  'admin.tabWrongInfo': 'Reports',
  'admin.imagesSubtitle':
    'Review user-submitted product photos. Approve sets the image on the catalog product.',
  'admin.wrongInfoSubtitle':
    'Review wrong-info reports. Edit the product below, then save & resolve — or dismiss.',
  'admin.imagesEmpty': 'No pending product images.',
  'admin.wrongInfoEmpty': 'No pending wrong-info reports.',
  'admin.wrongInfoEmne': 'Subject',
  'admin.wrongInfoComment': 'Explanation',
  'admin.wrongInfoProductMissing': 'Linked product was not found in the catalog.',
  'admin.wrongInfoEditHint': 'Edit the product fields below, then save & resolve.',
  'admin.saveAndResolve': 'Save & resolve',
  'admin.dismiss': 'Dismiss',
  'admin.catalog': 'Catalog',
  'admin.name': 'Name',
  'admin.produsent': 'Producer',
  'admin.barcode': 'Barcode',
  'admin.submittedBy': 'Submitted by',
  'admin.submittedAt': 'Submitted',
  'admin.ingredients': 'Ingredients',
  'admin.glutenRating': 'Gluten rating',
  'admin.editHint': 'Edit any fields below before approving.',
  'admin.nameRequired': 'Product name is required.',
  'admin.viewImage': 'View full image',
  'admin.approve': 'Approve',
  'admin.deny': 'Deny',
  'admin.prev': 'Previous',
  'admin.next': 'Next',
  'admin.pageOf': 'Page {page} of {total}',
  'admin.open': 'Admin',
  'login.subtitleSignIn': 'Sign in to continue',
  'login.subtitleRegister': 'Create an account to get started',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.email': 'Email',
  'login.phone': 'Phone',
  'login.plan': 'Membership',
  'login.planMonthly': 'Monthly 35 kr',
  'login.planYearly': 'Yearly 350 kr',
  'login.paymentLinkSent':
    'A payment link was sent to your email. Pay there, then sign in.',
  'login.sendPaymentLink': 'Send payment link',
  'login.continue': 'Continue',
  'login.back': 'Back',
  'login.step1Title': 'Your details',
  'login.step2Title': 'Verify & membership',
  'login.stepOf': 'Step {step} of {total}',
  'login.usernamePlaceholder': 'Your username',
  'login.passwordPlaceholder': 'Your password',
  'login.showPassword': 'Show password',
  'login.hidePassword': 'Hide password',
  'login.emailPlaceholder': 'you@example.com',
  'login.phonePlaceholder': '+47 000 00 000',
  'login.signIn': 'Sign in',
  'login.createAccount': 'Create account',
  'login.haveAccount': 'Already have an account? ',
  'login.noAccount': "Don't have an account? ",
  'login.register': 'Register',
  'login.registerOpenFailed': 'Could not open the registration page. Try again later.',
  'login.note':
    'Membership is required to create an account.',
  'login.usernameShort': 'Username must be at least 3 characters.',
  'login.passwordShort': 'Password must be at least 6 characters.',
  'login.emailInvalid': 'Enter a valid email address.',
  'login.phoneInvalid': 'Enter a valid phone number.',
  'login.smsCode': 'SMS code',
  'login.smsCodePlaceholder': '6-digit code',
  'login.sendSms': 'Send SMS code',
  'login.resendSms': 'Resend SMS code',
  'login.smsCodeRequired': 'Request an SMS code and enter it before creating an account.',
  'login.genericError': 'Something went wrong.',
  'login.poweredBy': 'Powered by AltUten',
  'products.searchLabel': 'Search by product name',
  'products.searchPlaceholder': 'e.g. surdeigsbrød, yoghurt...',
  'products.hint':
    'At least {min} characters. Report barcodes on products to earn points.',
  'products.recentTitle': 'Recent searches',
  'products.results': '{count} results',
  'products.resultOne': '1 result',
  'products.empty': 'No products matched.',
  'products.barcodeUnknown': 'Barcode: unknown',
  'products.searchFailed': 'Search failed.',
  'products.prevPage': 'Previous',
  'products.nextPage': 'Next',
  'products.pageLabel': 'Page {page} / {totalPages}',
  'products.resultsProgress': '{shown} / {total}',
  'result.barcode': 'Barcode',
  'result.scannedBarcode': 'Scanned barcode',
  'result.lookingUp': 'Looking up product...',
  'result.errorTitle': 'Something went wrong',
  'result.lookupFailed': 'Lookup failed.',
  'result.productImageA11y': 'product image',
  'result.country': 'Country of origin',
  'result.allergenWarnTitle': 'Allergen warning',
  'result.allergenContains': 'Contains {name}',
  'result.allergenMayContain': 'May contain {name}',
  'result.allergenBadgeContains': 'Contains {name}',
  'result.allergenBadgeMayContain': 'Traces of {name}',
  'result.ingredients': 'Ingredients',
  'result.noIngredients': 'No ingredients recorded.',
  'result.reportBarcode': 'Report barcode',
  'result.reportWrongInfo': 'Report wrong info',
  'result.signInToReportWrongInfo': 'Sign in to report wrong product information.',
  'result.wrongInfoEmne': 'Subject',
  'result.wrongInfoEmnePlaceholder': 'e.g. Wrong gluten status',
  'result.wrongInfoComment': 'Explanation',
  'result.wrongInfoCommentPlaceholder': 'Describe what is wrong…',
  'result.wrongInfoSubmit': 'Send report',
  'result.wrongInfoEmneShort': 'Subject must be at least 3 characters.',
  'result.wrongInfoCommentShort': 'Explanation must be at least 5 characters.',
  'result.wrongInfoSent': 'Thanks — your report was sent.',
  'result.reportHint':
    'This product is missing a barcode. Enter the code below or scan the barcode so we can find the product next time.',
  'result.signInToReport': 'Sign in to report a barcode for this product.',
  'result.enterBarcode': 'Enter barcode digits',
  'result.scanBarcode': 'Scan barcode',
  'result.photoOptional': 'Product photo (optional)',
  'result.photoLocked': 'This product already has a photo.',
  'result.addPhoto': 'Add photo',
  'result.changePhoto': 'Change photo',
  'result.removePhoto': 'Remove',
  'result.submitPhoto': 'Submit photo',
  'result.photoPending': 'Thanks — photo sent for admin review.',
  'result.photoSaved': 'Thanks — photo saved on this product.',
  'result.addPhotoHint':
    'This product is missing a photo. Add one so we can review it before we make it visible.',
  'result.signInToAddPhoto': 'Sign in to submit a photo for this product.',
  'result.submitBarcode': 'Submit barcode',
  'result.reportPending':
    'Thanks — suggestion recorded. It applies when reporters’ combined levels reach 100, or an admin approves it.',
  'result.reportSaved': 'Thanks — barcode saved on this product.',
  'result.reportFailed': 'Could not save barcode.',
  'result.barcodeAlreadyLinked': 'This barcode is already linked to another product.',
  'result.editProduct': 'Edit this product',
  'result.notFound': 'Product not found',
  'result.notFoundAdmin':
    'This barcode is not in the database yet. Add a new product, or link the code to an existing product that still has an unknown barcode.',
  'result.notFoundUser':
    'This barcode is not in the database yet. You can link it to an existing product with an unknown barcode, or submit a new product for admin review.',
  'result.notFoundGuest':
    'This barcode is not in the database yet. Sign in to submit or link a product.',
  'result.addOrLink': 'Add or link product',
  'add.signInRequired': 'Sign in required',
  'add.signInRequiredBody':
    'Log in to submit a product. Non-admin submissions wait for admin approval.',
  'add.adminRequired': 'Admin access required',
  'add.adminRequiredBody': 'Only admins can edit products that are already in the catalog.',
  'add.editTitle': 'Edit product',
  'add.addTitle': 'Add a product',
  'add.editSubtitle': 'Update this product’s details and gluten rating.',
  'add.addSubtitleAdmin':
    'Create a new product, or link this scanned barcode to an existing one that has no barcode yet.',
  'add.addSubtitleUser':
    'Link this scanned barcode to an existing product without a barcode, or submit a new product for admin review.',
  'add.barcode': 'Barcode',
  'add.barcodePlaceholder': 'Barcode digits',
  'add.barcodeFromScan': 'Barcode taken from the scan.',
  'add.linkTitle': 'Link to existing product',
  'add.linkHint':
    'Search our catalog for products without a known barcode.',
  'add.searchName': 'Search product name...',
  'add.glutenFree': 'Gluten free',
  'add.containsGluten': 'With Gluten',
  'add.unknownBarcode': 'unknown barcode',
  'add.noMatch': 'No unknown-barcode products matched.',
  'add.photoOptional': 'Product photo (optional)',
  'add.photoRequired': 'Product photo (required)',
  'add.photoRequiredBody': 'Add a photo of the product to submit it for review.',
  'add.photoLocked': 'This product already has a photo.',
  'add.noPhoto': 'No photo attached yet.',
  'add.addPhoto': 'Add photo',
  'add.changePhoto': 'Change photo',
  'add.removePhoto': 'Remove',
  'add.linking': 'Linking...',
  'add.linkButton': 'Link barcode to selected product',
  'add.orCreate': 'Or create a new product',
  'add.newSubmission': 'New product submission',
  'add.produsent': 'Producer',
  'add.produsentPlaceholder': 'e.g. Schär',
  'add.productName': 'Product name',
  'add.namePlaceholder': 'e.g. Gluten Free Bread',
  'add.ingredients': 'Ingredients / contents',
  'add.ingredientsPlaceholder':
    "List the ingredients and any 'produced in a facility that also handles wheat' notes.",
  'add.glutenRating': 'Gluten rating',
  'add.allergens': 'Allergens',
  'add.allergensHint':
    'Tap allergens the product contains, and separately any that may be present as traces.',
  'add.allergenContains': 'Contains',
  'add.allergenMayContain': 'Traces of',
  'add.allergenFree': 'Free',
  'add.saving': 'Saving...',
  'add.saveChanges': 'Save changes',
  'add.saveNew': 'Save new product',
  'add.submitReview': 'Submit for review',
  'add.missingBarcode': 'Missing barcode',
  'add.missingBarcodeBody': 'Please enter or scan a barcode first.',
  'add.missingPhotoBody': 'A product photo is required to submit for review.',
  'add.pickProduct': 'Pick a product',
  'add.pickProductBody': 'Search and select an existing product with unknown barcode.',
  'add.submittedTitle': 'Sent for approval',
  'add.submittedBody':
    'The product has been sent for approval. If it is approved, you will gain 20 XP.',
  'add.submittedBarcodeBody':
    'Your barcode report has been sent for approval. If it is approved, you will gain 10 XP.',
  'add.linkedTitle': 'Linked',
  'add.linkedBody': '"{name}" is now linked to barcode {barcode}.',
  'add.couldNotLink': 'Could not link',
  'add.missingName': 'Missing name',
  'add.missingNameBody': 'Please enter the product name.',
  'add.missingRating': 'Missing gluten rating',
  'add.missingRatingBody': 'Please choose a gluten rating.',
  'add.savedTitle': 'Saved',
  'add.savedUpdated': '"{name}" has been updated.',
  'add.savedAdded': '"{name}" has been added.',
  'add.couldNotSave': 'Could not save',
};

const nb: Record<TranslationKey, string> = {
  'nav.scanner': 'AltUten',
  'nav.result': 'Skanneresultat',
  'nav.add': 'Legg til produkt',
  'nav.products': 'Søk produkter',
  'nav.profile': 'Profil',
  'nav.settings': 'Innstillinger',
  'nav.admin': 'Admin',
  'nav.leaderboard': 'Ledertavle',
  'nav.signIn': 'Logg inn',
  'common.loading': 'Laster...',
  'common.guest': 'Gjest',
  'common.admin': 'Admin',
  'common.member': 'Medlem',
  'common.level': 'Nivå',
  'common.back': 'Tilbake',
  'common.close': 'Lukk',
  'common.saving': 'Lagrer...',
  'common.cancel': 'Avbryt',
  'common.delete': 'Slett',
  'common.unknownError': 'Ukjent feil.',
  'common.goBack': 'Gå tilbake',
  'common.closeKeyboard': 'Lukk tastatur',
  'common.done': 'Ferdig',
  'errors.network': 'Kunne ikke koble til. Sjekk internettforbindelsen og prøv igjen.',
  'errors.unavailable': 'Tjenesten er midlertidig utilgjengelig. Prøv igjen senere.',
  'errors.unauthorized': 'Logg inn for å fortsette.',
  'errors.forbidden': 'Du har ikke tillatelse til å gjøre det.',
  'errors.notFound': 'Vi fant ikke det du lette etter.',
  'errors.invalidCredentials': 'Feil brukernavn eller passord.',
  'errors.usernameTaken': 'Det brukernavnet er allerede i bruk. Prøv et annet.',
  'errors.barcodeTaken': 'Denne strekkoden er allerede linket til et annet produkt.',
  'errors.productHasBarcode': 'Dette produktet har allerede en strekkode.',
  'errors.validation': 'Sjekk det du skrev inn og prøv igjen.',
  'errors.searchTooShort': 'Skriv minst 4 tegn for å søke.',
  'errors.imageInvalid': 'Bildet kunne ikke brukes. Prøv et annet.',
  'errors.lookupFailed': 'Kunne ikke slå opp dette produktet. Prøv igjen.',
  'errors.searchFailed': 'Kunne ikke søke akkurat nå. Prøv igjen.',
  'errors.saveFailed': 'Kunne ikke lagre. Prøv igjen.',
  'errors.reportFailed': 'Kunne ikke sende inn strekkoden. Prøv igjen.',
  'errors.loginFailed': 'Kunne ikke logge inn. Prøv igjen.',
  'errors.registerFailed': 'Kunne ikke opprette kontoen. Prøv igjen.',
  'errors.conflict': 'Handlingen kunne ikke fullføres på grunn av en konflikt.',
  'errors.rateLimited': 'Vent {seconds} sekunder før du oppdaterer igjen.',
  'errors.generic': 'Noe gikk galt. Prøv igjen.',
  'errors.startup': 'Appen kunne ikke starte. Prøv igjen.',
  'rating.glutenFree': 'Glutenfri',
  'rating.glutenFreeDesc': 'Bekreftet glutenfri.',
  'rating.glutenTrace': 'Kan inneholde spor',
  'rating.glutenTraceDesc': 'Laget med eller nær matvarer som inneholder gluten.',
  'rating.glutenContent': 'Med Gluten',
  'rating.glutenContentDesc': 'Dette produktet inneholder gluten.',
  'settings.theme': 'Tema',
  'settings.themeHint': 'Bytt mellom lyst og mørkt utseende.',
  'settings.light': 'Lyst',
  'settings.dark': 'Mørkt',
  'settings.language': 'Språk',
  'settings.languageHint': 'Velg norsk eller engelsk.',
  'settings.norwegian': 'Norsk',
  'settings.english': 'Engelsk',
  'settings.productCountry': 'Produktland',
  'settings.productCountryHint':
    'Velg ett eller flere land for skanning og søk. Trykk for å slå av/på.',
  'country.no': 'Norge',
  'country.se': 'Sverige',
  'country.dk': 'Danmark',
  'country.de': 'Tyskland',
  'settings.allergens': 'Allergenvarsler',
  'settings.allergensHint':
    'Velg allergener du vil bli advart om når et produkt inneholder dem eller kan inneholde dem.',
  'settings.about': 'Om',
  'settings.aboutBody':
    'AltUten slår opp strekkoder i produktkatalogen (ingredienser, allergener og opprinnelsesland når det er tilgjengelig).',
  'settings.disclaimer': 'Ansvarsfraskrivelse',
  'settings.disclaimerBody':
    'Produktinformasjon kan være ufullstendig eller feil. Vi kan ikke ta ansvar hvis noen — også personer med alvorlige allergier — blir skadet av å stole på denne appen. Sjekk alltid emballasjen selv, og søk medisinsk råd ved behov.',
  'scanner.disclaimer':
    'Informasjon kan være feil eller ufullstendig. Vi tar ikke ansvar for allergiske reaksjoner eller annen skade. Sjekk alltid emballasjen.',
  'settings.scanning': 'Skanning',
  'settings.scanningBody':
    'Hold inne den runde skanneknappen på kameraskjermen for å aktivere strekkodeskanning. Slipp for å stoppe.',
  'settings.dataSource': 'Datakilde',
  'settings.dataRemote': 'Produkter hentes fra ekstern API / Azure SQL-database.',
  'settings.dataLocal': 'Produkter lagres i den lokale SQLite-databasen på denne enheten.',
  'settings.adminNote': 'Du er innlogget med admin-tilgang.',
  'scanner.checkingPermission': 'Sjekker kameratilgang...',
  'scanner.holdToScan': 'Hold for å skanne',
  'scanner.scanning': 'Skanner…',
  'scanner.holdA11y': 'Hold for å skanne strekkode',
  'scanner.cameraNeeded': 'Kameratilgang trengs',
  'scanner.cameraHint': 'Gi kameratilgang for å skanne matstrekkoder.',
  'scanner.grantCamera': 'Gi kameratilgang',
  'scanner.simulatorNote': 'iOS-simulatoren har ikke kamera. Test på en fysisk enhet.',
  'scanner.lastScanned': 'Sist skannet strekkode',
  'scanner.addProduct': '+ Legg til produkt',
  'scanner.searchProducts': 'Søk produkter',
  'scanner.profile': 'Profil',
  'scanner.settings': 'Innstillinger',
  'scanner.leaderboard': 'Ledertavle',
  'leaderboard.subtitle': 'Top 100 Bidragsytere',
  'leaderboard.day': 'Dag',
  'leaderboard.week': 'Uke',
  'leaderboard.month': 'Måned',
  'leaderboard.updated': 'Oppdatert',
  'leaderboard.empty': 'Ingen XP-gevinster i denne perioden ennå.',
  'leaderboard.you': 'deg',
  'leaderboard.anonymous': 'Anonym',
  'profile.account': 'Konto',
  'profile.signedInApi': 'Innlogget i AltUten.',
  'profile.localMode': 'Lokal modus — ingen ekstern konto kreves.',
  'profile.logOut': 'Logg ut',
  'profile.xp': 'XP',
  'profile.xpProgress': 'Nivå {level}',
  'profile.xpToNext': '{remaining} XP til neste nivå',
  'profile.xpMaxLevel': 'Høyeste nivå nådd',
  'profile.xpHistory': 'XP-historikk',
  'profile.xpHistoryEmpty': 'Ingen XP ennå. Rapporter strekkoder for å tjene poeng.',
  'profile.xpReasonBarcode': 'Strekkoderapport godkjent{detail}',
  'profile.xpReasonSubmission': 'Produktforslag godkjent{detail}',
  'profile.xpReasonWrongInfo': 'Feilrapport godkjent{detail}',
  'profile.xpReasonOther': 'XP-belønning',
  'profile.privacy': 'Ledertavle-personvern',
  'profile.anonymousTitle': 'Vis som anonym',
  'profile.anonymousHint':
    'Når dette er på, skjules brukernavnet ditt på ledertavlen og du vises som anonym.',
  'profile.favorites': 'Favorittprodukter',
  'profile.lists': 'Lister',
  'profile.changePhoto': 'Endre profilbilde',
  'profile.photoUpdating': 'Oppdaterer bilde…',
  'profile.photoError': 'Kunne ikke oppdatere profilbildet.',
  'favorites.title': 'Favoritter',
  'favorites.searchPlaceholder': 'Søk i favoritter…',
  'favorites.empty': 'Ingen favorittprodukter ennå. Legg til fra en produktside.',
  'favorites.noneMatch': 'Ingen favoritter matcher søket.',
  'favorites.loading': 'Laster favoritter…',
  'lists.title': 'Lister',
  'lists.myLists': 'Mine lister',
  'lists.sharedLists': 'Delte lister',
  'lists.create': 'Ny liste',
  'lists.namePlaceholder': 'Listenavn',
  'lists.emptyMine': 'Ingen lister ennå. Opprett en for å komme i gang.',
  'lists.emptyShared': 'Ingen lister er delt med deg ennå.',
  'lists.emptyProducts': 'Denne listen har ingen produkter ennå.',
  'lists.products': 'produkter',
  'lists.productCount': '{count} produkter',
  'lists.ownedBy': 'Av {username}',
  'lists.sharedWith': 'Delt med',
  'lists.sharedWithCount': 'delt med {count}',
  'lists.share': 'Del',
  'lists.shareTitle': 'Del «{name}»',
  'lists.shareUsernamePlaceholder': 'Brukernavn å dele med',
  'lists.addToList': 'Legg til i liste',
  'lists.addedToList': 'Lagt til i listen',
  'lists.noListsYet': 'Du har ingen lister ennå. Opprett en nedenfor.',
  'lists.createAndAdd': 'Opprett og legg til',
  'lists.deleteTitle': 'Slette listen?',
  'lists.deleteBody': 'Slette «{name}»? Dette kan ikke angres.',
  'lists.removeItemTitle': 'Fjerne fra listen?',
  'lists.removeItemBody': 'Vil du fjerne «{name}» fra listen?',
  'lists.removeItemConfirm': 'Fjern',
  'lists.notFound': 'Listen ble ikke funnet.',
  'result.addFavorite': 'Legg til i favoritter',
  'result.removeFavorite': 'Fjern fra favoritter',
  'admin.subtitle': 'Gå gjennom ventende produktforslag. Godkjenn for å legge dem til i katalogen.',
  'admin.empty': 'Ingen ventende produktforslag.',
  'admin.tabProducts': 'Produkter',
  'admin.tabImages': 'Bilder',
  'admin.tabWrongInfo': 'Rapporter',
  'admin.imagesSubtitle':
    'Gå gjennom brukerinnsente produktbilder. Godkjenn for å sette bildet på produktet i katalogen.',
  'admin.wrongInfoSubtitle':
    'Gå gjennom feil-info-rapporter. Rediger produktet nedenfor, lagre og løs — eller avvis.',
  'admin.imagesEmpty': 'Ingen ventende produktbilder.',
  'admin.wrongInfoEmpty': 'Ingen ventende feil-info-rapporter.',
  'admin.wrongInfoEmne': 'Emne',
  'admin.wrongInfoComment': 'Forklaring',
  'admin.wrongInfoProductMissing': 'Koblet produkt ble ikke funnet i katalogen.',
  'admin.wrongInfoEditHint': 'Rediger produktfeltene nedenfor, lagre og løs deretter.',
  'admin.saveAndResolve': 'Lagre og løs',
  'admin.dismiss': 'Avvis',
  'admin.catalog': 'Katalog',
  'admin.name': 'Navn',
  'admin.produsent': 'Produsent',
  'admin.barcode': 'Strekkode',
  'admin.submittedBy': 'Sendt inn av',
  'admin.submittedAt': 'Sendt inn',
  'admin.ingredients': 'Ingredienser',
  'admin.glutenRating': 'Glutenstatus',
  'admin.editHint': 'Rediger feltene nedenfor før du godkjenner.',
  'admin.nameRequired': 'Produktnavn er påkrevd.',
  'admin.viewImage': 'Vis bilde i full størrelse',
  'admin.approve': 'Godkjenn',
  'admin.deny': 'Avvis',
  'admin.prev': 'Forrige',
  'admin.next': 'Neste',
  'admin.pageOf': 'Side {page} av {total}',
  'admin.open': 'Admin',
  'login.subtitleSignIn': 'Logg inn for å fortsette',
  'login.subtitleRegister': 'Opprett en konto for å komme i gang',
  'login.username': 'Brukernavn',
  'login.password': 'Passord',
  'login.email': 'E-post',
  'login.phone': 'Telefon',
  'login.plan': 'Medlemskap',
  'login.planMonthly': 'Månedlig 35 kr',
  'login.planYearly': 'Årlig 350 kr',
  'login.paymentLinkSent':
    'Betalingslenke er sendt på e-post. Betal der, deretter logg inn.',
  'login.sendPaymentLink': 'Send betalingslenke',
  'login.continue': 'Fortsett',
  'login.back': 'Tilbake',
  'login.step1Title': 'Dine opplysninger',
  'login.step2Title': 'Bekreftelse og medlemskap',
  'login.stepOf': 'Steg {step} av {total}',
  'login.usernamePlaceholder': 'Ditt brukernavn',
  'login.passwordPlaceholder': 'Ditt passord',
  'login.showPassword': 'Vis passord',
  'login.hidePassword': 'Skjul passord',
  'login.emailPlaceholder': 'deg@eksempel.no',
  'login.phonePlaceholder': '+47 000 00 000',
  'login.signIn': 'Logg inn',
  'login.createAccount': 'Opprett konto',
  'login.haveAccount': 'Har du allerede en konto? ',
  'login.noAccount': 'Har du ikke en konto? ',
  'login.register': 'Registrer',
  'login.registerOpenFailed': 'Kunne ikke åpne registreringssiden. Prøv igjen senere.',
  'login.note':
    'Medlemskap kreves for å opprette konto.',
  'login.usernameShort': 'Brukernavn må være minst 3 tegn.',
  'login.passwordShort': 'Passord må være minst 6 tegn.',
  'login.emailInvalid': 'Skriv inn en gyldig e-postadresse.',
  'login.phoneInvalid': 'Skriv inn et gyldig telefonnummer.',
  'login.smsCode': 'SMS-kode',
  'login.smsCodePlaceholder': '6-sifret kode',
  'login.sendSms': 'Send SMS-kode',
  'login.resendSms': 'Send SMS-kode på nytt',
  'login.smsCodeRequired': 'Be om SMS-kode og skriv den inn før du oppretter konto.',
  'login.genericError': 'Noe gikk galt.',
  'login.poweredBy': 'Powered by AltUten',
  'products.searchLabel': 'Søk etter produktnavn',
  'products.searchPlaceholder': 'f.eks. surdeigsbrød, yoghurt...',
  'products.hint':
    'Minst {min} tegn. Rapporter strekkoder på produkter for å tjene poeng.',
  'products.recentTitle': 'Siste søk',
  'products.results': '{count} resultater',
  'products.resultOne': '1 resultat',
  'products.empty': 'Ingen produkter matchet.',
  'products.barcodeUnknown': 'Strekkode: ukjent',
  'products.searchFailed': 'Søk feilet.',
  'products.prevPage': 'Forrige',
  'products.nextPage': 'Neste',
  'products.pageLabel': 'Side {page} / {totalPages}',
  'products.resultsProgress': '{shown} / {total}',
  'result.barcode': 'Strekkode',
  'result.scannedBarcode': 'Skannet strekkode',
  'result.lookingUp': 'Slår opp produkt...',
  'result.errorTitle': 'Noe gikk galt',
  'result.lookupFailed': 'Oppslag feilet.',
  'result.productImageA11y': 'produktbilde',
  'result.country': 'Opprinnelsesland',
  'result.allergenWarnTitle': 'Allergenvarsel',
  'result.allergenContains': 'Inneholder {name}',
  'result.allergenMayContain': 'Kan inneholde {name}',
  'result.allergenBadgeContains': 'Med {name}',
  'result.allergenBadgeMayContain': 'Spor av {name}',
  'result.ingredients': 'Ingredienser',
  'result.noIngredients': 'Ingen ingredienser registrert.',
  'result.reportBarcode': 'Rapporter strekkode',
  'result.reportWrongInfo': 'Rapporter feil info',
  'result.signInToReportWrongInfo': 'Logg inn for å rapportere feil produktinformasjon.',
  'result.wrongInfoEmne': 'Emne',
  'result.wrongInfoEmnePlaceholder': 'f.eks. Feil glutenstatus',
  'result.wrongInfoComment': 'Forklaring',
  'result.wrongInfoCommentPlaceholder': 'Beskriv hva som er feil…',
  'result.wrongInfoSubmit': 'Send rapport',
  'result.wrongInfoEmneShort': 'Emne må være minst 3 tegn.',
  'result.wrongInfoCommentShort': 'Forklaring må være minst 5 tegn.',
  'result.wrongInfoSent': 'Takk — rapporten er sendt.',
  'result.reportHint':
    'Dette produktet mangler strekkode. Skriv inn koden under eller skann strekkode så vi finner produktet neste gang.',
  'result.signInToReport': 'Logg inn for å rapportere strekkode for dette produktet.',
  'result.enterBarcode': 'Skriv inn strekkodesifre',
  'result.scanBarcode': 'Skann strekkode',
  'result.photoOptional': 'Produktbilde (valgfritt)',
  'result.photoLocked': 'Dette produktet har allerede et bilde.',
  'result.addPhoto': 'Legg til bilde',
  'result.changePhoto': 'Bytt bilde',
  'result.removePhoto': 'Fjern',
  'result.submitPhoto': 'Send bilde',
  'result.photoPending': 'Bilde er sendt til vurdering.',
  'result.photoSaved': 'Takk — bildet er lagret på produktet.',
  'result.addPhotoHint':
    'Dette produktet mangler bilde. Legg til ett som vi kan se over før vi synliggjør det.',
  'result.signInToAddPhoto': 'Logg inn for å sende inn bilde til dette produktet.',
  'result.submitBarcode': 'Send strekkode',
  'result.reportPending':
    'Takk — forslaget er lagret. Det brukes når rapportørers samlede nivå når 100, eller en admin godkjenner det.',
  'result.reportSaved': 'Takk — strekkoden er lagret på produktet.',
  'result.reportFailed': 'Kunne ikke lagre strekkode.',
  'result.barcodeAlreadyLinked': 'Denne strekkoden er allerede linket til et annet produkt.',
  'result.editProduct': 'Rediger dette produktet',
  'result.notFound': 'Produktet ble ikke funnet',
  'result.notFoundAdmin':
    'Denne strekkoden er ikke i databasen ennå. Legg til et nytt produkt, eller knytt koden til et eksisterende produkt som fortsatt har ukjent strekkode.',
  'result.notFoundUser':
    'Denne strekkoden er ikke i databasen ennå. Du kan knytte den til et eksisterende produkt med ukjent strekkode, eller sende inn et nytt produkt til admin-vurdering.',
  'result.notFoundGuest':
    'Denne strekkoden er ikke i databasen ennå. Logg inn for å sende inn eller knytte et produkt.',
  'result.addOrLink': 'Legg til eller knytt produkt',
  'add.signInRequired': 'Innlogging kreves',
  'add.signInRequiredBody':
    'Logg inn for å sende inn et produkt. Innsendinger fra ikke-admin venter på godkjenning.',
  'add.adminRequired': 'Admin-tilgang kreves',
  'add.adminRequiredBody': 'Bare admin kan redigere produkter som allerede er i katalogen.',
  'add.editTitle': 'Rediger produkt',
  'add.addTitle': 'Legg til produkt',
  'add.editSubtitle': 'Oppdater detaljene og glutenstatus for dette produktet.',
  'add.addSubtitleAdmin':
    'Opprett et nytt produkt, eller knytt denne skannede strekkoden til et eksisterende uten strekkode.',
  'add.addSubtitleUser':
    'Knytt denne skannede strekkoden til et eksisterende produkt uten strekkode, eller send inn et nytt produkt til admin-vurdering.',
  'add.barcode': 'Strekkode',
  'add.barcodePlaceholder': 'Strekkodesifre',
  'add.barcodeFromScan': 'Strekkode hentet fra skanningen.',
  'add.linkTitle': 'Knytt til eksisterende produkt',
  'add.linkHint':
    'Søk i vårt varelager etter produkter uten kjent strekkode.',
  'add.searchName': 'Søk produktnavn...',
  'add.glutenFree': 'Glutenfri',
  'add.containsGluten': 'Med Gluten',
  'add.unknownBarcode': 'ukjent strekkode',
  'add.noMatch': 'Ingen produkter med ukjent strekkode matchet.',
  'add.photoOptional': 'Produktbilde (valgfritt)',
  'add.photoRequired': 'Produktbilde (påkrevd)',
  'add.photoRequiredBody': 'Legg til et bilde av produktet for å sende inn til vurdering.',
  'add.photoLocked': 'Dette produktet har allerede et bilde.',
  'add.noPhoto': 'Ingen bilde lagt ved ennå.',
  'add.addPhoto': 'Legg til bilde',
  'add.changePhoto': 'Bytt bilde',
  'add.removePhoto': 'Fjern',
  'add.linking': 'Kobler...',
  'add.linkButton': 'Knytt strekkode til valgt produkt',
  'add.orCreate': 'Eller opprett et nytt produkt',
  'add.newSubmission': 'Ny produktinnsending',
  'add.produsent': 'Produsent',
  'add.produsentPlaceholder': 'f.eks. Schär',
  'add.productName': 'Produktnavn',
  'add.namePlaceholder': 'f.eks. Glutenfritt brød',
  'add.ingredients': 'Ingredienser / innhold',
  'add.ingredientsPlaceholder':
    'List opp ingrediensene og eventuelle merknader om «produsert i anlegg som også håndterer hvete».',
  'add.glutenRating': 'Glutenstatus',
  'add.allergens': 'Allergener',
  'add.allergensHint':
    'Trykk på allergenene produktet inneholder, og separat de som kan finnes som spor.',
  'add.allergenContains': 'Inneholder',
  'add.allergenMayContain': 'Spor av',
  'add.allergenFree': 'Fri',
  'add.saving': 'Lagrer...',
  'add.saveChanges': 'Lagre endringer',
  'add.saveNew': 'Lagre nytt produkt',
  'add.submitReview': 'Send til vurdering',
  'add.missingBarcode': 'Mangler strekkode',
  'add.missingBarcodeBody': 'Skriv inn eller skann en strekkode først.',
  'add.missingPhotoBody': 'Et produktbilde er påkrevd for å sende inn til vurdering.',
  'add.pickProduct': 'Velg et produkt',
  'add.pickProductBody': 'Søk og velg et eksisterende produkt med ukjent strekkode.',
  'add.submittedTitle': 'Sendt til godkjenning',
  'add.submittedBody':
    'Produktet er sendt til godkjenning. Hvis det blir godkjent, får du 20 XP.',
  'add.submittedBarcodeBody':
    'Strekkoderapporten din er sendt til godkjenning. Hvis den blir godkjent, får du 10 XP.',
  'add.linkedTitle': 'Koblet',
  'add.linkedBody': '«{name}» er nå knyttet til strekkode {barcode}.',
  'add.couldNotLink': 'Kunne ikke knytte',
  'add.missingName': 'Mangler navn',
  'add.missingNameBody': 'Skriv inn produktnavnet.',
  'add.missingRating': 'Mangler glutenstatus',
  'add.missingRatingBody': 'Velg en glutenstatus.',
  'add.savedTitle': 'Lagret',
  'add.savedUpdated': '«{name}» er oppdatert.',
  'add.savedAdded': '«{name}» er lagt til.',
  'add.couldNotSave': 'Kunne ikke lagre',
};

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, nb };

export type { TranslationKey };

export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
}

export function translateFormat(
  locale: Locale,
  key: TranslationKey,
  vars: Record<string, string | number>
): string {
  let text = translate(locale, key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}
