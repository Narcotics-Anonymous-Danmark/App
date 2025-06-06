import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'contact',
    loadChildren: () => import('./pages/contact/contact.module').then( m => m.ContactPageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./pages/home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'listfull',
    loadChildren: () => import('./pages/listfull/listfull.module').then( m => m.ListfullPageModule)
  },
  {
    path: 'location-search',
    loadChildren: () => import('./pages/location-search/location-search.module').then( m => m.LocationSearchPageModule)
  },
  {
    path: 'map-search',
    loadChildren: () => import('./pages/map-search/map-search.module').then( m => m.MapSearchPageModule)
  },
  {
    path: 'modal',
    loadChildren: () => import('./pages/modal/modal.module').then( m => m.ModalPageModule)
  },
  {
    path: 'settings',
    loadChildren: () => import('./pages/settings/settings.module').then( m => m.SettingsPageModule)
  },
  {
    path: 'virt-tabs',
    loadChildren: () => import('./pages/virt-tabs/virt-tabs.module').then( m => m.VirtTabsPageModule)
  },
  {
    path: 'coming-soon',
    loadChildren: () => import('./pages/coming-soon/coming-soon.module').then( m => m.ComingSoonPageModule)
  },
  {
    path: 'jft',
    loadChildren: () => import('./pages/jft/jft.module').then( m => m.JftPageModule)
  },
  {
    path: 'grc',
    loadChildren: () => import('./pages/grc/grc.module').then( m => m.GrcPageModule)
  },
  {
    path: 'speaks',
    loadChildren: () => import('./pages/speaks/speaks.module').then( m => m.SpeaksPageModule)
  },
  {
    path: 'events',
    loadChildren: () => import('./pages/events/events.module').then( m => m.EventsPageModule)
  },
  {
    path: 'cleantime-counter',
    loadChildren: () => import('./pages/cleantime-counter/cleantime-counter.module').then( m => m.CleantimeCounterPageModule)
  },
  {
    path: 'audiobooks',
    loadChildren: () => import('./pages/audiobooks/audiobooks.module').then( m => m.AudioBooksPageModule)
  },
  {
    path: 'basic-text',
    loadChildren: () => import('./pages/basic-text/basic-text.module').then( m => m.BasicTextPageModule)
  },
  {
    path: 'how-and-why',
    loadChildren: () => import('./pages/how-and-why/how-and-why.module').then( m => m.HowAndWhyPageModule)
  },
  {
    path: 'step-working-guides',
    loadChildren: () => import('./pages/step-working-guides/step-working-guides.module').then( m => m.StepWorkingGuidesPageModule)
  }

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
