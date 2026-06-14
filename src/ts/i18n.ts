export type AppLocale = 'en' | 'es';
export type LanguagePreference = 'auto' | AppLocale;

type I18nParams = Record<string, string | number>;

const ES: Record<string, string> = {
	'Auto (browser)': 'Auto (navegador)',
	English: 'Ingles',
	Spanish: 'Espanol',
	'Extension language': 'Idioma de la extension',
	'Use browser language, English, or Spanish for this extension UI.':
		'Usa el idioma del navegador, ingles o espanol para la interfaz de esta extension.',
	'Better AA Developer Experience': 'Better AA Developer Experience',
	'Open Better AA sidebar': 'Abrir panel de Better AA',
	'Open Better AA Developer Experience sidebar': 'Abrir panel de Better AA Developer Experience',
	'Better AA': 'Better AA',
	Tools: 'Herramientas',
	'UI Improvements': 'Mejoras UI',
	Settings: 'Ajustes',
	'Extension Settings': 'Ajustes de extension',
	'Command palette': 'Paleta de comandos',
	'Show command palette': 'Mostrar paleta de comandos',
	'Enable the in-page command palette shortcut and popup.':
		'Activa el atajo y la ventana de la paleta de comandos en la pagina.',
	'Sidebar shortcut': 'Atajo del panel',
	'Sounds': 'Sonidos',
	'Run, error, and done tones': 'Tonos de ejecutar, error y terminado',
	'Show suggestions': 'Mostrar sugerencias',
	'Short mouse-click tips for common shortcuts':
		'Consejos breves de clic para atajos comunes',
	'Block taskbot link clicks': 'Bloquear clics en enlaces de taskbot',
	'Prevent left-click navigation on taskbot node links; middle-click still works.':
		'Evita navegar con clic izquierdo en enlaces de nodos taskbot; clic medio sigue funcionando.',
	'Taskbot link click blocked': 'Clic en enlace taskbot bloqueado',
	'Use middle-click to open this link.':
		'Usa clic medio para abrir este enlace.',
	'Force Automation Anywhere English': 'Forzar Automation Anywhere en ingles',
	'Set Automation Anywhere locale to en-US and reload when needed. Does not change this extension language.':
		'Establece Automation Anywhere en en-US y recarga cuando haga falta. No cambia el idioma de esta extension.',
	'Universal Clipboard': 'Portapapeles universal',
	'Action JSON': 'JSON de accion',
	'Action summary': 'Resumen de accion',
	'Expand action summary': 'Expandir resumen de accion',
	'Collapse action summary': 'Contraer resumen de accion',
	'Advanced: imports raw Automation Anywhere clipboard JSON.':
		'Avanzado: importa JSON sin procesar del portapapeles de Automation Anywhere.',
	'Universal copy loads selected action JSON here. Paste JSON here to import.':
		'La copia universal carga aqui el JSON de la accion seleccionada. Pega JSON aqui para importar.',
	'Clear JSON': 'Limpiar JSON',
	'Clear the Action JSON field.': 'Limpia el campo JSON de accion.',
	'Import JSON': 'Importar JSON',
	'Import textarea JSON into AA clipboard.':
		'Importa el JSON del campo al portapapeles de AA.',
	'Copy JSON': 'Copiar JSON',
	'Copy textarea JSON to system clipboard.':
		'Copia el JSON del campo al portapapeles del sistema.',
	'Export JSON': 'Exportar JSON',
	'Download textarea JSON as a .json file.':
		'Descarga el JSON del campo como archivo .json.',
	Default: 'Predeterminado',
	'Slot {slot}': 'Espacio {slot}',
	'Load {label}': 'Cargar {label}',
	Empty: 'Vacio',
	Copy: 'Copiar',
	Clear: 'Limpiar',
	Paste: 'Pegar',
	'Sidebar sections': 'Secciones del panel',
	'Save current AA clipboard to this slot.':
		'Guarda el portapapeles actual de AA en este espacio.',
	'Paste this slot through AA shared paste.':
		'Pega este espacio usando el pegado compartido de AA.',
	'Taskbot Editor': 'Editor Taskbot',
	'Folder navigation': 'Navegacion de carpetas',
	General: 'General',
	'Loading Animation': 'Animacion de carga',
	'Background Customization': 'Personalizacion de fondo',
	'Reset Colors': 'Restablecer colores',
	'Restore background gradient defaults.':
		'Restaura los valores predeterminados del gradiente de fondo.',
	'Restore to Default': 'Restaurar predeterminado',
	'Reset all UI Improvements options.':
		'Restablece todas las opciones de Mejoras UI.',
	'Control Room': 'Control Room',
	'Checking version...': 'Verificando version...',
	Refresh: 'Actualizar',
	'Version unavailable.': 'Version no disponible.',
	'Supported target: {target}': 'Target soportado: {target}',
	'Supported target matched.': 'Target soportado coincide.',
	'Unsupported target.': 'Target no soportado.',
	'Current: {current}. Supported target: {target}. Validated build: {build}.':
		'Actual: {current}. Target soportado: {target}. Build validado: {build}.',
	'Build differs from validated build {build}. Styles still load.':
		'Build difiere del build validado {build}. Los estilos igual cargan.',
	'Control Room version unavailable: {message}':
		'Version de Control Room no disponible: {message}',
	'Control Room version unavailable.':
		'Version de Control Room no disponible.',
	'UI Improvements blocked until target matches or force is enabled.':
		'Mejoras UI bloqueadas hasta que el target coincida o se active forzar.',
	'Force styles on unsupported Control Room':
		'Forzar estilos en Control Room no soportado',
	'Use UI Improvements even when Control Room target differs.':
		'Usa Mejoras UI aunque el target de Control Room difiera.',
	'Unsupported Control Room styles forced on.':
		'Estilos en Control Room no soportado forzados.',
	'Unsupported Control Room styles force disabled.':
		'Forzado de estilos en Control Room no soportado desactivado.',
	'Run Doctor': 'Ejecutar Doctor',
	'Run selector Doctor and write report to Debug Log.':
		'Ejecuta Doctor de selectores y escribe el reporte en el Log debug.',
	'Doctor running...': 'Doctor ejecutandose...',
	'Doctor failed.': 'Doctor fallo.',
	'Doctor report added to Debug Log.':
		'Reporte de Doctor agregado al Log debug.',
	'Doctor {view}: {passed} pass, {failed} fail, {warnings} warn, {skipped} skip.':
		'Doctor {view}: {passed} ok, {failed} fallo, {warnings} alerta, {skipped} omitido.',
	'No Doctor findings.': 'Sin hallazgos de Doctor.',
	Pass: 'Ok',
	Fail: 'Fallo',
	Warn: 'Alerta',
	Skip: 'Omitido',
	'Injected styles': 'Estilos inyectados',
	'Enable all custom style rules': 'Activa todas las reglas de estilo personalizadas',
	'Palette buttons': 'Botones de paleta',
	'Use compact Actions, Variables, and Triggers palette layout.':
		'Usa un diseno compacto para Acciones, Variables y Disparadores.',
	'Run button style': 'Estilo del boton Ejecutar',
	'Animate and emphasize Run.': 'Anima y resalta Ejecutar.',
	'Hide editor tabs': 'Ocultar pestanas del editor',
	'Hide Flow, List, and Dual tabs button group.':
		'Oculta el grupo de botones Flujo, Lista y Dual.',
	'Minimize running bot window': 'Minimizar ventana de bot en ejecucion',
	'Add Minimize and Maximize controls to the running bot window.':
		'Agrega controles Minimizar y Maximizar a la ventana de bot en ejecucion.',
	'Adds Minimize and Maximize buttons to the running bot window. Minimized mode keeps the page behind it clickable.':
		'Agrega botones Minimizar y Maximizar a la ventana de bot en ejecucion. El modo minimizado mantiene clicable la pagina detras.',
	'Running bot window position': 'Posicion de ventana de bot en ejecucion',
	'Choose where the minimized running bot window appears.':
		'Elige donde aparece la ventana minimizada de bot en ejecucion.',
	'Bottom left': 'Abajo izquierda',
	'Bottom right': 'Abajo derecha',
	'Top left': 'Arriba izquierda',
	'Top right': 'Arriba derecha',
	Minimize: 'Minimizar',
	Maximize: 'Maximizar',
	'Scrollable folders': 'Carpetas desplazables',
	'Makes folder sidebar sticky and scrollable. On folder pages, centers active folder automatically.':
		'Hace fija y desplazable la barra lateral de carpetas. En paginas de carpeta, centra automaticamente la carpeta activa.',
	'Folder columns': 'Columnas de carpeta',
	'Widen folder table columns.': 'Ensancha columnas de la tabla de carpetas.',
	'Slim sidebar': 'Barra lateral delgada',
	'Collapse Pathfinder until hover.': 'Contrae Pathfinder hasta pasar el cursor.',
	'Disabled because Better AA Slim sidebar is enabled.':
		'Desactivado porque la barra lateral delgada de Better AA esta activada.',
	'Custom background': 'Fondo personalizado',
	'Apply custom TaskBot background gradient.':
		'Aplica un gradiente de fondo personalizado al TaskBot.',
	'Loading animation': 'Animacion de carga',
	'Replace loading animation image.': 'Reemplaza la imagen de animacion de carga.',
	'Loading animation image': 'Imagen de animacion de carga',
	'Upload replacement png, jpg, jpeg, webp, or gif. Empty uses bundled default.':
		'Sube un png, jpg, jpeg, webp o gif de reemplazo. Vacio usa el predeterminado incluido.',
	'Loading image size': 'Tamano de imagen de carga',
	'Sizing mode for replacement loading animation image.':
		'Modo de tamano para la imagen de animacion de carga de reemplazo.',
	contain: 'Contener',
	cover: 'Cubrir',
	auto: 'Automatico',
	'Gradient 1': 'Gradiente 1',
	'Gradient 2': 'Gradiente 2',
	'Gradient 3': 'Gradiente 3',
	'TaskBot background gradient color.': 'Color de gradiente de fondo del TaskBot.',
	'{label} opacity': 'Opacidad de {label}',
	'Use default': 'Usar predeterminado',
	'Use bundled loading animation image.':
		'Usa la animacion de carga incluida.',
	'Loading animation preview': 'Vista previa de animacion de carga',
	'Loading animation file could not be used as an image.':
		'El archivo de animacion de carga no se pudo usar como imagen.',
	'Loading animation uploaded.': 'Animacion de carga subida.',
	'Loading animation upload failed.': 'Subida de animacion de carga fallo.',
	'Default loading animation restored.':
		'Animacion de carga predeterminada restaurada.',
	'Unsupported loading animation image. Use png, jpg, jpeg, webp, or gif.':
		'Imagen de animacion de carga no compatible. Usa png, jpg, jpeg, webp o gif.',
	'Loading animation image is too large. Maximum size is 3 MiB.':
		'La imagen de animacion de carga es demasiado grande. Tamano maximo: 3 MiB.',
	'File could not be read as a data URL.':
		'No se pudo leer el archivo como data URL.',
	'Loading animation image read failed.':
		'Lectura de imagen de animacion de carga fallo.',
	'Gradient colors restored.': 'Colores de gradiente restaurados.',
	'Visual improvements restored.': 'Mejoras UI restauradas.',
	About: 'Acerca de',
	Version: 'Version',
	'GitHub repository': 'Repositorio GitHub',
	'Open project repository.': 'Abre el repositorio del proyecto.',
	'Debug Mode': 'Modo debug',
	'Debug Log': 'Log debug',
	'Expand debug log': 'Expandir log debug',
	'Collapse debug log': 'Contraer log debug',
	'Show or hide recent debug entries.':
		'Muestra u oculta entradas debug recientes.',
	'Copy support log for troubleshooting.':
		'Copia el log de soporte para diagnostico.',
	'Clear local debug log entries.': 'Limpia entradas debug locales.',
	'Debug Mode stores local support logs. Nothing is sent automatically.':
		'Modo debug guarda logs de soporte locales. Nada se envia automaticamente.',
	'No debug log.': 'No hay log debug.',
	'DETAILS IN COPY': 'DETALLES EN COPIA',
	'Debug log cleared.': 'Log debug limpiado.',
	'Debug log copied for AI.': 'Log debug copiado para IA.',
	'Debug log copy failed.': 'Copia de log debug fallo.',
	'Extension language saved.': 'Idioma de extension guardado.',
	'Debug mode enabled.': 'Modo debug activado.',
	'Debug mode disabled.': 'Modo debug desactivado.',
	'Suggestions enabled.': 'Sugerencias activadas.',
	'Suggestions disabled.': 'Sugerencias desactivadas.',
	'Command palette enabled.': 'Paleta de comandos activada.',
	'Command palette disabled.': 'Paleta de comandos desactivada.',
	'Taskbot link click blocking enabled.':
		'Bloqueo de clics en enlaces taskbot activado.',
	'Taskbot link click blocking disabled.':
		'Bloqueo de clics en enlaces taskbot desactivado.',
	'Sidebar shortcut saved.': 'Atajo del panel guardado.',
	'# Better AA Developer Experience Debug Log': '# Better AA Developer Experience Debug Log',
	'Stored entries: {count}': 'Entradas guardadas: {count}',
	'Entry {count}': 'Entrada {count}',
	'Timestamp: {value}': 'Marca de tiempo: {value}',
	'Level: {value}': 'Nivel: {value}',
	'Source: {value}': 'Fuente: {value}',
	'Message: {value}': 'Mensaje: {value}',
	'Details JSON:': 'Detalles JSON:',
	'JSON details': 'Detalles JSON',
	'No active tab.': 'No hay pestana activa.',
	'Open an Automation Anywhere tab first.':
		'Abre primero una pestana de Automation Anywhere.',
	'Current: {shortcut}': 'Actual: {shortcut}',
	'{label} is empty.': '{label} esta vacio.',
	'{label} JSON loaded.': 'JSON de {label} cargado.',
	'{label} copied.': '{label} copiado.',
	'English locale enforcement enabled.':
		'Forzado de ingles en Automation Anywhere activado.',
	'English locale enforcement disabled.':
		'Forzado de ingles en Automation Anywhere desactivado.',
	'JSON textarea is empty.': 'El campo JSON esta vacio.',
	'Invalid JSON.': 'JSON invalido.',
	'Invalid JSON': 'JSON invalido',
	'JSON is not Automation Anywhere clipboard JSON.':
		'El JSON no es JSON de portapapeles de Automation Anywhere.',
	'Automation Anywhere summary failed.':
		'Fallo el resumen de Automation Anywhere.',
	action: 'accion',
	actions: 'acciones',
	'Import queued.': 'Importacion en cola.',
	'JSON copied to clipboard.': 'JSON copiado al portapapeles.',
	'JSON exported.': 'JSON exportado.',
	'Clipboard write failed.': 'Escritura al portapapeles fallo.',
	'JSON cleared.': 'JSON limpiado.',
	'Paste queued.': 'Pegado en cola.',
	'Copied slot {slot}.': 'Espacio {slot} copiado.',
	'Could not copy slot {slot}.': 'No se pudo copiar espacio {slot}.',
	'Pasted slot {slot}.': 'Espacio {slot} pegado.',
	'Copy failed.': 'Copia fallo.',
	'Export queued.': 'Exportacion en cola.',
	'Sidebar import field opened.': 'Campo de importacion del panel abierto.',
	'Action failed.': 'Accion fallo.',
	'Language changed': 'Idioma cambiado',
	'For correct functioning of this extension, the language will be set to English (en-US). The page will reload.':
		'Para que esta extension funcione correctamente, el idioma de Automation Anywhere se cambiara a ingles (en-US). La pagina se recargara.',
	'Close notification': 'Cerrar notificacion',
	Packages: 'Paquetes',
	Variables: 'Variables',
	Actions: 'Acciones',
	Triggers: 'Disparadores',
	'Search commands...': 'Buscar comandos...',
	'Search commands': 'Buscar comandos',
	'Go to line {line}': 'Ir a linea {line}',
	'Scroll the taskbot editor to a specific line.':
		'Desplaza el editor taskbot a una linea especifica.',
	'Open the extension sidebar.': 'Abre el panel de la extension.',
	'Open the dialog to create a new variable.':
		'Abre el dialogo para crear una variable nueva.',
	'Show the Actions palette.': 'Muestra la paleta de Acciones.',
	'Show the Variables palette.': 'Muestra la paleta de Variables.',
	'Show the Triggers palette.': 'Muestra la paleta de Disparadores.',
	'Open the dialog to select and delete unused variables.':
		'Abre el dialogo para seleccionar y eliminar variables sin uso.',
	'Show help for available commands.': 'Muestra ayuda de comandos disponibles.',
	'Save current Automation Anywhere clipboard to default slot.':
		'Guarda el portapapeles actual de Automation Anywhere en el espacio predeterminado.',
	'Paste default slot through Automation Anywhere shared paste.':
		'Pega el espacio predeterminado usando el pegado compartido de Automation Anywhere.',
	'Export the currently copied action as JSON to your clipboard.':
		'Exporta la accion copiada como JSON al portapapeles.',
	'Open sidebar Action JSON field for import.':
		'Abre el campo JSON de accion del panel para importar.',
	'Go to {label}.': 'Ir a {label}.',
	Help: 'Ayuda',
	'Open sidebar with {shortcut}, then go to Settings/About for help.':
		'Abre el panel con {shortcut}, luego ve a Ajustes/Acerca de para ayuda.',
	'Open sidebar manually': 'Abre el panel manualmente',
	'Sidebar failed': 'El panel fallo',
	'Could not open extension sidebar.': 'No se pudo abrir el panel de la extension.',
	'Export failed': 'Exportacion fallida',
	'Universal clipboard is empty.': 'El portapapeles universal esta vacio.',
	Exported: 'Exportado',
	'Action JSON copied to your clipboard.':
		'JSON de accion copiado al portapapeles.',
	'Could not write action JSON to the clipboard.':
		'No se pudo escribir el JSON de accion al portapapeles.',
	'List of Commands:': 'Lista de comandos:',
	Navigation: 'Navegacion:',
	'Keyboard Shortcuts:': 'Atajos de teclado:',
	'Clipboard Slots:': 'Espacios del portapapeles:',
	'Open command palette': 'Abrir paleta de comandos',
	'Open sidebar; configurable in extension sidebar.':
		'Abrir panel; configurable en el panel de la extension.',
	'Show variables': 'Mostrar variables',
	'Show actions': 'Mostrar acciones',
	'Native Automation Anywhere shared copy auto-saves default slot. Use sidepanel controls for slots.':
		'La copia compartida nativa de Automation Anywhere guarda automaticamente el espacio predeterminado. Usa los controles del panel para espacios.',
	'Scrolls to a specific line number (e.g. {example})':
		'Desplaza a un numero de linea especifico (ej. {example})',
	'Tip': 'Consejo',
	'Tip: toggle editor palette with Ctrl+D.':
		'Consejo: alterna la paleta del editor con Ctrl+D.',
	'Tip: open variables with Alt+V.':
		'Consejo: abre variables con Alt+V.',
	'Tip: open actions with Alt+A.':
		'Consejo: abre acciones con Alt+A.',
	'Tip: open command palette with {shortcut}.':
		'Consejo: abre la paleta de comandos con {shortcut}.',
	'Copy failed': 'Copia fallida',
	'Automation Anywhere clipboard is empty.':
		'El portapapeles de Automation Anywhere esta vacio.',
	'Universal clipboard updated': 'Portapapeles universal actualizado',
	Copied: 'Copiado',
	'Default slot saved from Automation Anywhere copy.':
		'Espacio predeterminado guardado desde la copia de Automation Anywhere.',
	'Saved current Automation Anywhere clipboard to default slot.':
		'Portapapeles actual de Automation Anywhere guardado en el espacio predeterminado.',
	'Could not read current clipboard JSON.':
		'No se pudo leer el JSON del portapapeles actual.',
	'Shared copy button not found.': 'Boton de copia compartida no encontrado.',
	'Clipboard JSON was not available in time for slot {slot}.':
		'El JSON del portapapeles no estuvo disponible a tiempo para el espacio {slot}.',
	'Saved current selection to slot {slot}.':
		'Seleccion actual guardada en el espacio {slot}.',
	'Could not save data to slot {slot}.':
		'No se pudieron guardar datos en el espacio {slot}.',
	'Nothing to paste': 'Nada para pegar',
	'Slot {slot} is empty.': 'El espacio {slot} esta vacio.',
	'Paste failed': 'Pegado fallido',
	'Shared paste button not found.': 'Boton de pegado compartido no encontrado.',
	Pasted: 'Pegado',
	'Inserted content from slot {slot}.': 'Contenido insertado desde el espacio {slot}.',
	'Inserted content from universal clipboard.':
		'Contenido insertado desde el portapapeles universal.',
	'Import failed': 'Importacion fallida',
	'Paste the action JSON first.': 'Pega primero el JSON de accion.',
	'Import queued': 'Importacion en cola',
	'JSON accepted. Pasting action now.':
		'JSON aceptado. Pegando accion ahora.',
	'Tools unavailable': 'Herramientas no disponibles',
	'Tools available on current page': 'Herramientas disponibles en la pagina actual',
	'No tools available on current page': 'No hay herramientas disponibles en la pagina actual',
	'Green = tools available. Red = no tools here.':
		'Verde = herramientas disponibles. Rojo = no hay herramientas aqui.',
	'Refresh tools': 'Actualizar herramientas',
	'Detect tools for current AA page.':
		'Detecta herramientas para la pagina actual de AA.',
	'Open Automation Anywhere folder, taskbot, or packages page.':
		'Abre una carpeta, taskbot o pagina de paquetes de Automation Anywhere.',
	'Open an Automation Anywhere folder, taskbot, or Packages page, then refresh.':
		'Abre una carpeta, taskbot o pagina de Paquetes de Automation Anywhere y actualiza.',
	Files: 'Archivos',
	'{count} selected': '{count} seleccionados',
	'0 selected': '0 seleccionados',
	'Search files': 'Buscar archivos',
	'Select visible': 'Seleccionar visibles',
	'Load more': 'Cargar mas',
	Run: 'Ejecutar',
	'Run selected tool action.': 'Ejecuta la accion seleccionada.',
	'Paste copied files': 'Pegar archivos copiados',
	'Paste into this folder. Duplicates are skipped.':
		'Pega en esta carpeta. Se omiten duplicados.',
	'Export format': 'Formato de exportacion',
	'ZIP (single archive)': 'ZIP (archivo unico)',
	'Separate files': 'Archivos separados',
	'Includes taskbot dependencies and uploaded files; produces one .zip file.':
		'Incluye dependencias de taskbot y archivos subidos; produce un archivo .zip.',
	'Downloads each selected file individually.':
		'Descarga cada archivo seleccionado individualmente.',
	'Packages used:': 'Paquetes usados:',
	'Copy package list to clipboard.':
		'Copia la lista de paquetes al portapapeles.',
	'Package list copied.': 'Lista de paquetes copiada.',
	Idle: 'Inactivo',
	'Tool finished': 'Herramienta terminada',
	Close: 'Cerrar',
	'Taskbot JSON': 'JSON de taskbot',
	'Expand Taskbot JSON': 'Expandir JSON de taskbot',
	'Collapse Taskbot JSON': 'Contraer JSON de taskbot',
	'Copy Files': 'Copiar archivos',
	'Update Packages': 'Actualizar paquetes',
	'Export Bots': 'Exportar bots',
	'Download Packages': 'Descargar paquetes',
	'Use saved AA clipboard slots.': 'Usa espacios guardados del portapapeles AA.',
	'Copy file references inside this extension.':
		'Copia referencias de archivos dentro de esta extension.',
	'Apply default package versions to selected bots.':
		'Aplica versiones predeterminadas de paquetes a los bots seleccionados.',
	'Export selected files as a ZIP or separate downloads.':
		'Exporta archivos seleccionados como ZIP o descargas separadas.',
	'Download packages from this page.': 'Descarga paquetes desde esta pagina.',
	'Load and edit raw taskbot JSON.': 'Carga y edita JSON de taskbot sin procesar.',
	'Store selected file references inside extension.':
		'Guarda referencias de archivos seleccionados dentro de la extension.',
	'Update selected bots using default package versions.':
		'Actualiza bots seleccionados usando versiones predeterminadas de paquetes.',
	'Create one ZIP with taskbot dependencies and uploaded files.':
		'Crea un ZIP con dependencias de taskbot y archivos subidos.',
	'Download each selected file individually.':
		'Descarga cada archivo seleccionado individualmente.',
	'Download selected package JAR files.':
		'Descarga archivos JAR de paquetes seleccionados.',
	'Stores file references inside extension. Open another folder on same host to paste.':
		'Guarda referencias de archivos dentro de la extension. Abre otra carpeta del mismo host para pegar.',
	'Updates selected taskbots using package defaults from this Control Room.':
		'Actualiza taskbots seleccionados usando valores predeterminados de paquetes de este Control Room.',
	'ZIP includes selected files and taskbot dependencies.':
		'El ZIP incluye archivos seleccionados y dependencias de taskbot.',
	'Downloads selected files one at a time.':
		'Descarga archivos seleccionados uno por uno.',
	'Downloads selected packages from the Packages page.':
		'Descarga paquetes seleccionados desde la pagina Paquetes.',
	'Loading...': 'Cargando...',
	'Loading more...': 'Cargando mas...',
	'{count} item(s) loaded.': '{count} elemento(s) cargado(s).',
	'{count} package(s) loaded.': '{count} paquete(s) cargado(s).',
	'Folder list failed.': 'Lista de carpeta fallo.',
	'Package list failed.': 'Lista de paquetes fallo.',
	unknown: 'desconocido',
	'Version {version}': 'Version {version}',
	'Version {version} | missing pkgDownloadUrl':
		'Version {version} | falta pkgDownloadUrl',
	'Search packages': 'Buscar paquetes',
	'{selected} selected / {loaded} loaded':
		'{selected} seleccionados / {loaded} cargados',
	'No matches.': 'Sin coincidencias.',
	'No packages found.': 'No se encontraron paquetes.',
	'No actions found.': 'No se encontraron acciones.',
	'No variables found.': 'No se encontraron variables.',
	'No files found.': 'No se encontraron archivos.',
	'Copy {count} file(s)': 'Copiar {count} archivo(s)',
	'Update {count} bot(s)': 'Actualizar {count} bot(s)',
	'Export {count} file(s)': 'Exportar {count} archivo(s)',
	'Download {count} package(s)': 'Descargar {count} paquete(s)',
	'Paste {count} copied file(s)': 'Pegar {count} archivo(s) copiado(s)',
	'{count} file(s) in clipboard. Open target folder to paste.':
		'{count} archivo(s) en el portapapeles. Abre la carpeta destino para pegar.',
	'Paste Copied Files': 'Pegar archivos copiados',
	'Pasting...': 'Pegando...',
	'Pasting {count} copied file(s)...':
		'Pegando {count} archivo(s) copiado(s)...',
	'Skipped duplicate: {name}': 'Duplicado omitido: {name}',
	'Copied: {name}': 'Copiado: {name}',
	'Failed: {name} - {message}': 'Fallo: {name} - {message}',
	'copy failed': 'copia fallida',
	'update failed': 'actualizacion fallida',
	'Processed {count}/{total}': 'Procesados {count}/{total}',
	'Paste done. Copied {copied}, skipped {skipped}, failed {failed}.':
		'Pegado terminado. Copiados {copied}, omitidos {skipped}, fallidos {failed}.',
	'Updating...': 'Actualizando...',
	'Loading default package versions...':
		'Cargando versiones predeterminadas de paquetes...',
	'No default package versions found.':
		'No se encontraron versiones predeterminadas de paquetes.',
	'Loaded {count} default package version(s).':
		'Cargadas {count} version(es) predeterminadas de paquetes.',
	'Skipped: {name} - no package change':
		'Omitido: {name} - sin cambio de paquetes',
	'Updated: {name} - {count} package(s)':
		'Actualizado: {name} - {count} paquete(s)',
	'Update packages done. Updated {updated}, skipped {skipped}, failed {failed}.':
		'Actualizacion de paquetes terminada. Actualizados {updated}, omitidos {skipped}, fallidos {failed}.',
	'Update packages failed.': 'Actualizacion de paquetes fallo.',
	'Exporting...': 'Exportando...',
	'Exporting {count} file(s). Do not close sidepanel.':
		'Exportando {count} archivo(s). No cierres el panel.',
	'Downloading file {count} of {total}: {name}':
		'Descargando archivo {count} de {total}: {name}',
	'Creating ZIP export for {count} file(s). Do not close sidepanel.':
		'Creando exportacion ZIP para {count} archivo(s). No cierres el panel.',
	'Fetching taskbot dependencies...': 'Obteniendo dependencias de taskbot...',
	'No taskbots selected. Skipping dependency lookup.':
		'No hay taskbots seleccionados. Omitiendo busqueda de dependencias.',
	'Dependency graph loaded: {count} file(s).':
		'Grafo de dependencias cargado: {count} archivo(s).',
	'Scanning {count} taskbot file(s) for metadata paths...':
		'Escaneando {count} archivo(s) taskbot por rutas de metadata...',
	'Metadata references found: {count}.':
		'Referencias de metadata encontradas: {count}.',
	'Package references found: {count}.':
		'Referencias de paquetes encontradas: {count}.',
	'Metadata scan done: {count} reference(s).':
		'Escaneo de metadata terminado: {count} referencia(s).',
	'Downloading {count} export file(s)...':
		'Descargando {count} archivo(s) de exportacion...',
	'Creating ZIP...': 'Creando ZIP...',
	'Download ready.': 'Descarga lista.',
	'Downloaded: {fileName}': 'Descargado: {fileName}',
	'Export downloaded: {fileName}': 'Exportacion descargada: {fileName}',
	'ZIP export failed: {message}': 'Exportacion ZIP fallo: {message}',
	'ZIP export failed. Falling back to separate files.':
		'La exportacion ZIP fallo. Cambiando a archivos separados.',
	'Export files done. Exported {exported}, failed {failed}.':
		'Exportacion de archivos terminada. Exportados {exported}, fallidos {failed}.',
	'Downloading...': 'Descargando...',
	'Downloading {count} package(s)...':
		'Descargando {count} paquete(s)...',
	'Skipped: {label} - missing pkgDownloadUrl':
		'Omitido: {label} - falta pkgDownloadUrl',
	'download failed': 'descarga fallida',
	'Download packages done. Downloaded {downloaded}, skipped {skipped}, failed {failed}.':
		'Descarga de paquetes terminada. Descargados {downloaded}, omitidos {skipped}, fallidos {failed}.',
	'Download packages failed.': 'Descarga de paquetes fallo.',
	'File {fileId}': 'Archivo {fileId}',
	'Taskbot JSON loaded.': 'JSON de taskbot cargado.',
	'Taskbot JSON load failed.': 'Carga de JSON de taskbot fallo.',
	'Taskbot JSON is empty.': 'JSON de taskbot esta vacio.',
	'Taskbot JSON copied.': 'JSON de taskbot copiado.',
	'Taskbot JSON formatted.': 'JSON de taskbot formateado.',
	Find: 'Buscar',
	Replace: 'Reemplazar',
	'Match case': 'Coincidir mayusculas',
	Previous: 'Anterior',
	Next: 'Siguiente',
	'Replace all': 'Reemplazar todo',
	'Repository ref': 'Ref repositorio',
	'New ref': 'Nueva ref',
	'Find ref': 'Buscar ref',
	'Replace ref': 'Reemplazar ref',
	'Copy refs': 'Copiar refs',
	'Repository refs': 'Refs de repositorio',
	'Expand repository refs': 'Expandir refs de repositorio',
	'Collapse repository refs': 'Contraer refs de repositorio',
	'{count} ref(s)': '{count} ref(s)',
	Refs: 'Refs',
	'No repository refs found.': 'No se encontraron refs de repositorio.',
	'No search term.': 'Sin termino de busqueda.',
	'Match {current} of {count}.': 'Coincidencia {current} de {count}.',
	'{count} match(es).': '{count} coincidencia(s).',
	'Replaced 1 match.': 'Reemplazada 1 coincidencia.',
	'Replace {count} match(es)?': 'Reemplazar {count} coincidencia(s)?',
	'Replaced {count} match(es).': 'Reemplazadas {count} coincidencia(s).',
	'{count} repository ref(s), {occurrences} occurrence(s).':
		'{count} ref(s) de repositorio, {occurrences} ocurrencia(s).',
	'New ref must start with repository:.':
		'Nueva ref debe empezar con repository:.',
	'Replace {count} repository ref occurrence(s)?':
		'Reemplazar {count} ocurrencia(s) de ref de repositorio?',
	'Replaced {count} repository ref occurrence(s).':
		'Reemplazadas {count} ocurrencia(s) de ref de repositorio.',
	'Repository refs copied.': 'Refs de repositorio copiadas.',
	'Taskbot JSON changed in Control Room. Reload before saving.':
		'El JSON de taskbot cambio en Control Room. Recarga antes de guardar.',
	changed: 'cambiado',
	unchanged: 'sin cambios',
	'Save JSON for file {fileId}? Status: {status}.':
		'Guardar JSON para archivo {fileId}? Estado: {status}.',
	'Update taskbot content in Control Room?':
		'Actualizar contenido del taskbot en Control Room?',
	'Taskbot JSON saved.': 'JSON de taskbot guardado.',
	'Taskbot JSON save failed.': 'Guardado de JSON de taskbot fallo.',
	'Package scan skipped: {message}':
		'Escaneo de paquetes omitido: {message}',
	'Metadata scan skipped: {message}':
		'Escaneo de metadata omitido: {message}',
	'Metadata scan progress: {count}/{total}':
		'Progreso de escaneo de metadata: {count}/{total}',
	'Selected file download failed: {message}':
		'Descarga del archivo seleccionado fallo: {message}',
	'Dependency omitted: {message}': 'Dependencia omitida: {message}',
	'File download progress: {count}/{total}':
		'Progreso de descarga de archivos: {count}/{total}',
	'Metadata omitted: {message}': 'Metadata omitida: {message}',
	'Metadata download progress: {count}/{total}':
		'Progreso de descarga de metadata: {count}/{total}',
	'Failed to create ZIP folder: {folder}':
		'No se pudo crear carpeta ZIP: {folder}',
	'Advanced: saves raw bot content back to Control Room.':
		'Avanzado: guarda contenido del bot sin procesar en Control Room.',
	'Load from Control Room': 'Cargar desde Control Room',
	'Load current taskbot content JSON.':
		'Cargar el JSON de contenido del taskbot actual.',
	'Copy to clipboard': 'Copiar al portapapeles',
	Format: 'Formatear',
	'Save JSON': 'Guardar JSON',
	'Save edited JSON back to Control Room.':
		'Guarda el JSON editado en Control Room.',
	'Unsupported page. Open Automation Anywhere folder, taskbot, or packages page.':
		'Pagina no compatible. Abre una carpeta, taskbot o pagina de paquetes de Automation Anywhere.',
	'Tools context failed.': 'Fallo el contexto de herramientas.',
	'{count} file(s) in clipboard. Paste available.':
		'{count} archivo(s) en el portapapeles. Pegado disponible.',
	'{count} {label} in clipboard.': '{count} {label} en el portapapeles.',
	file: 'archivo',
	files: 'archivos',
	'Private folder {id} on {host}': 'Carpeta privada {id} en {host}',
	'Public folder {id} on {host}': 'Carpeta publica {id} en {host}',
	'Private taskbot {id} on {host}': 'Taskbot privado {id} en {host}',
	'Public taskbot {id} on {host}': 'Taskbot publico {id} en {host}',
	'Packages on {host}': 'Paquetes en {host}',
	'Unsupported page.': 'Pagina no compatible.',
	'{title} failed': '{title} fallo',
	'{title} finished with warnings': '{title} termino con advertencias',
	'{title} finished': '{title} termino',
	'{summary} Duration: {seconds}s.': '{summary} Duracion: {seconds}s.',
	'No actions recorded.': 'No hay acciones registradas.',
	'Folder refresh queued.': 'Actualizacion de carpeta en cola.',
	'Refresh button not found.': 'Boton de actualizar no encontrado.',
};

let activeLocale: AppLocale = detectBrowserLocale();

export function detectBrowserLocale(): AppLocale {
	const browserLanguage =
		typeof browser !== 'undefined' && browser.i18n?.getUILanguage
			? browser.i18n.getUILanguage()
			: navigator.language;
	return browserLanguage?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
	return value === 'en' || value === 'es' ? value : 'auto';
}

export function resolveLanguagePreference(value: unknown): AppLocale {
	const preference = normalizeLanguagePreference(value);
	return preference === 'auto' ? detectBrowserLocale() : preference;
}

export function setActiveLocale(locale: AppLocale): void {
	activeLocale = locale;
	document.documentElement.lang = locale;
}

export function setActiveLanguagePreference(preference: unknown): AppLocale {
	const locale = resolveLanguagePreference(preference);
	setActiveLocale(locale);
	return locale;
}

export function getActiveLocale(): AppLocale {
	return activeLocale;
}

export function t(key: string, params: I18nParams = {}): string {
	const template = activeLocale === 'es' ? ES[key] ?? key : key;
	return template.replace(/\{(\w+)\}/g, (match, name) =>
		Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
	);
}
