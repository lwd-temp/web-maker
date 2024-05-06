/*eslint-env node*/

const fs = require('fs');
const gulp = require('gulp');
const { parallel, series, watch } = require('gulp');
const useref = require('gulp-useref');
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const concat = require('gulp-concat');
const babelMinify = require('babel-minify');
const child_process = require('child_process');
const merge = require('merge-stream');
// const zip = require('gulp-zip');
var packageJson = JSON.parse(fs.readFileSync('./package.json'));
const connect = require('gulp-connect');
const APP_FOLDER = 'create';

function minifyJs(fileName) {
	const content = fs.readFileSync(fileName, 'utf8');
	const minifiedContent = babelMinify(
		content,
		{ mangle: content.length < 700000 },
		{ sourceMaps: false }
	).code;
	fs.writeFileSync(fileName, minifiedContent);
	console.log(
		`[${fileName}]: ${content.length / 1024}K -> ${
			minifiedContent.length / 1024
		}K`
	);
}

function runWebpack() {
	return child_process.exec('npm run build', (error, stdout, stderr) => {
		console.log('runWebpack', error, stdout, stderr);
	});
}
gulp.task('runWebpack', function () {
	return child_process.exec('npm run build', (error, stdout, stderr) => {
		console.log('runWebpack', error, stdout, stderr);
	});
});

gulp.task('copyFiles', function () {
	return merge(
		gulp
			.src('src/lib/codemirror/theme/*')
			.pipe(gulp.dest(`${APP_FOLDER}/lib/codemirror/theme`)),
		gulp
			.src('src/lib/codemirror/mode/**/*')
			.pipe(gulp.dest(`${APP_FOLDER}/lib/codemirror/mode`)),
		gulp
			.src('src/lib/transpilers/*')
			.pipe(gulp.dest(`${APP_FOLDER}/lib/transpilers`)),
		gulp
			.src('src/lib/prettier-worker.js')
			.pipe(gulp.dest(`${APP_FOLDER}/lib/`)),
		gulp
			.src('src/lib/prettier/*')
			.pipe(gulp.dest(`${APP_FOLDER}/lib/prettier`)),
		gulp
			.src(['!src/lib/monaco/monaco.bundle.js', 'src/lib/monaco/**/*'])
			.pipe(gulp.dest(`${APP_FOLDER}/lib/monaco`)),
		gulp.src('src/lib/screenlog.js').pipe(gulp.dest(`${APP_FOLDER}/lib`)),
		gulp.src('icons/*').pipe(gulp.dest(`${APP_FOLDER}/icons`)),
		gulp.src('src/assets/*').pipe(gulp.dest(`${APP_FOLDER}/assets`)),
		gulp.src('src/templates/*').pipe(gulp.dest(`${APP_FOLDER}/templates`)),
		gulp.src('preview/*').pipe(gulp.dest(`${APP_FOLDER}/preview`)),
		gulp
			.src([
				'src/preview.html',
				'src/indexpm.html',
				'src/detached-window.js',
				'src/icon-48.png',
				'src/icon-128.png',
				'src/manifest.json'
			])
			.pipe(gulp.dest(APP_FOLDER)),

		gulp.src('build/*').pipe(gulp.dest(APP_FOLDER)),

		// Following CSS are copied to build/ folder where they'll be referenced by
		// useRef plugin to concat into one.
		gulp
			.src('src/lib/codemirror/lib/codemirror.css')
			.pipe(gulp.dest(`build/lib/codemirror/lib`)),
		gulp
			.src('src/lib/codemirror/addon/hint/show-hint.css')
			.pipe(gulp.dest(`build/lib/codemirror/addon/hint`)),
		gulp
			.src('src/lib/codemirror/addon/fold/foldgutter.css')
			.pipe(gulp.dest(`build/lib/codemirror/addon/fold`)),
		gulp
			.src('src/lib/codemirror/addon/dialog/dialog.css')
			.pipe(gulp.dest(`build/lib/codemirror/addon/dialog`)),
		gulp.src('src/lib/hint.min.css').pipe(gulp.dest('build/lib')),
		gulp.src('src/lib/inlet.css').pipe(gulp.dest('build/lib')),
		// gulp.src('src/style.css').pipe(gulp.dest('build')),

		gulp
			.src([
				'src/FiraCode.ttf',
				'src/FixedSys.ttf',
				'src/Inconsolata.ttf',
				'src/Monoid.ttf'
			])
			.pipe(gulp.dest(APP_FOLDER))
	);
});

gulp.task('useRef', function () {
	return gulp
		.src('build/index.html')
		.pipe(useref())
		.pipe(gulp.dest(APP_FOLDER));
});

gulp.task('concatSwRegistration', function () {
	const bundleFile = fs
		.readdirSync(APP_FOLDER)
		.filter(allFilesPaths => allFilesPaths.match(/bundle.*\.js$/) !== null)[0];

	console.log('matched', bundleFile);

	return gulp
		.src(['src/service-worker-registration.js', `${APP_FOLDER}/${bundleFile}`])
		.pipe(concat(bundleFile))
		.pipe(gulp.dest(APP_FOLDER));
});

gulp.task('minify', function () {
	// minifyJs('app/script.js');
	// minifyJs('app/vendor.js');
	minifyJs(`${APP_FOLDER}/lib/screenlog.js`);

	return gulp
		.src(`${APP_FOLDER}/*.css`)
		.pipe(
			cleanCSS(
				{
					debug: true
				},
				details => {
					console.log(
						`${details.name}: ${details.stats.originalSize} 👉🏼  ${details.stats.minifiedSize}`
					);
				}
			)
		)
		.pipe(gulp.dest(APP_FOLDER));
});

gulp.task('fixIndex', function (cb) {
	var contents = fs.readFileSync('build/index.html', 'utf8');
	// Replace hashed-filename script tags with unhashed ones
	contents = contents.replace(
		/\<\!\-\- SCRIPT-TAGS \-\-\>[\S\s]*?\<\!\-\- END-SCRIPT-TAGS \-\-\>/,
		'<script defer src="vendor.js"></script><script defer src="script.js"></script>'
	);

	// vendor.hash.js gets created outside our markers, so remove it
	contents = contents.replace(
		/\<script src="[\S\s]*?vendor\.[\S\s]*?\<\/script\>/,
		''
	);

	// fs.writeFileSync('build/index.html', contents, 'utf8');
	cb();
});

gulp.task('generate-service-worker', function (callback) {
	var swPrecache = require('sw-precache');
	var rootDir = APP_FOLDER;

	swPrecache.write(
		`${rootDir}/service-worker.js`,
		{
			staticFileGlobs: [
				rootDir + '/**/*.{js,html,css,png,jpg,gif,svg,eot,ttf,woff}'
			],
			stripPrefix: `${rootDir}/`,

			// has to be increased to around 2.8mb for sass.worker.js
			maximumFileSizeToCacheInBytes: 2900000
		},
		callback
	);
});

gulp.task('packageExtension', function () {
	child_process.execSync('rm -rf extension');
	child_process.execSync(`cp -R ${APP_FOLDER} extension`);
	child_process.execSync('cp src/manifest.json extension');
	child_process.execSync('cp src/options.js extension');
	child_process.execSync('cp src/options.html extension');
	child_process.execSync('cp src/eventPage.js extension');
	child_process.execSync('cp src/icon-16.png extension');
	child_process.execSync('rm -rf extension/service-worker.js');
	return merge(
		gulp
			.src('build/bundle.*.js')
			.pipe(rename('script.js'))
			.pipe(gulp.dest('extension'))

		// gulp
		// 	.src('extension/**/*')
		// 	.pipe(zip(`extension-${packageJson.version}.zip`))
		// 	.pipe(gulp.dest('./'))
	);
});

gulp.task('buildWebsite', function () {
	return child_process.exec(
		'npm run build-website',
		(error, stdout, stderr) => {
			console.log('buildWebsite', error, stdout, stderr);
		}
	);
});

gulp.task('buildDistFolder', function (cb) {
	child_process.execSync('rm -rf dist');
	child_process.execSync('mv packages/website/_site dist');
	child_process.execSync(`mv ${APP_FOLDER} dist/`);
	cb();
});

gulp.task('cleanup', function () {
	return child_process.exec('rm -rf build create');
});

gulp.task('start-preview-server', function () {
	connect.server({
		root: 'preview',
		port: 7888,
		https: false
	});
});

// TODO: fix tasks. eg. buildWebsite isn't needed anymore
exports.release = series(
	parallel('runWebpack', 'buildWebsite'),
	'copyFiles',
	'fixIndex',
	'useRef',
	'concatSwRegistration',
	'minify',
	'generate-service-worker',
	'packageExtension',
	'buildDistFolder',
	'cleanup',
	function (callback, error) {
		if (error) {
			console.log(error.message);
		} else {
			console.log('RELEASE FINISHED SUCCESSFULLY');
		}

		callback(error);
	}
);

exports.devRelease = gulp.series(
	parallel('runWebpack', 'buildWebsite'),
	'copyFiles',
	'fixIndex',
	'useRef',
	// 'concatSwRegistration',
	// 'generate-service-worker',
	'buildDistFolder',
	'cleanup',
	function (callback, error) {
		if (error) {
			console.log(error.message);
		} else {
			console.log('DEV-RELEASE FINISHED SUCCESSFULLY');
		}

		callback(error);
	}
);

const buildExtension = series(
	'runWebpack',
	'copyFiles',
	'fixIndex',
	'useRef',
	'packageExtension',
	'cleanup'
);

function runWatcher(cb) {
	return watch(
		['src/**/*.js', 'src/**/*.jsx', 'src/**/*.json'],
		function (cbb) {
			buildExtension();
			cbb();
		}
	);
	cb();
}

exports.setupExtension = series(
	buildExtension,
	runWatcher,
	function (callback, error) {
		if (error) {
			console.log(error.message);
		} else {
			console.log('RELEASE FINISHED SUCCESSFULLY');
		}

		callback(error);
	}
);

exports.buildExtension = buildExtension;
