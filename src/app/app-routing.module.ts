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
    path: 'do-i-have-the-bmlt',
    loadChildren: () => import('./pages/do-i-have-the-bmlt/do-i-have-the-bmlt.module').then( m => m.DoIHaveTheBmltPageModule)
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
  },  {
    path: 'coming-soon',
    loadChildren: () => import('./coming-soon/coming-soon.module').then( m => m.ComingSoonPageModule)
  }

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
